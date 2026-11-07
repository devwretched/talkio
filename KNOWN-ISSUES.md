# Known Issues & Half-Baked Workflows

> **Status:** 2026-11-07 · Audits the state of the codebase as-shipped.
> Every entry lists the **symptom**, the **root cause**, and a **suggested fix**.
> Severity: 🔴 **critical** / 🟠 **major** / 🟡 **minor** · Status: `open` / `fixed` / `parked`

---

## 1. Recently fixed (for the record)

### 1.1 Login fails with trailing whitespace in username — `fixed 2026-11-07`
- **Severity:** 🟡
- **Symptom:** `POST /api/auth/login` returned 401 when the username carried a leading/trailing space (e.g. `" wretched "` from browser autofill) even though the credentials were correct.
- **Root cause:** the DB lookup compared `username` verbatim, with no normalization.
- **Fix applied:** both `LoginHandler` and `RegisterHandler` trim the username (`strings.TrimSpace`), and the frontend login form now sends `username.trim()`. Database values are always stored trimmed.

---

## 2. Authentication & membership

### 2.1 Google login bypasses the invite gate — `open`
- **Severity:** 🔴 (only when the route is re-enabled)
- **Symptom:** `POST /api/auth/google` creates a brand-new account for any valid Google credential. No invite code required. The frontend doesn't call it today, so this is a latent hole, not an active one — but a single curl is enough to join without an invite right now.
- **Root cause:** `GoogleLogin` in `internal/handlers/auth.go` predates the invite system; it was never updated.
- **Suggested fix (pick one):**
  1. Delete the route entirely (simplest — matches the no-Google frontend), or
  2. Require an *unused* `InviteCode` with an `Email` field matching the Google token email and consume it on signup (the `InviteCode.Email` column already exists for exactly this path and is currently dead), or
  3. Require `GOOGLE_CLIENT_ID` to be set — if unset, return 404 so the endpoint is inert in production.
- **Also fails later:** Google users get `Password: ""` — they can never log in via the username/password path, so a Google account is unrecoverable from the app's own gate.

### 2.2 No password change & no password recovery — `open`
- **Severity:** 🟠
- **Symptom:** members cannot change their password anywhere in the app, and forgotten passwords are unrecoverable (no email flow).
- **Root cause:** no route was ever written (`PUT /api/me/password` does not exist); emails are `@hearth.local` placeholders (see 2.3).
- **Suggested fix:** add `PUT /api/me/password` (current password + new password, bcrypt re-hash); for recovery, decide consciously whether Hearth *has email at all* — for a small invite-only club, an "ask an admin to reset it" flow is acceptable and much simpler than email infrastructure.

### 2.3 Emails are fake placeholders — `open`
- **Severity:** 🟡
- **Symptom:** every username/password account is stored with `username + "@hearth.local"`; the profile editor hides it. Nothing consumes real email.
- **Root cause:** email exists only as a legacy `unique` column from the pre-rename app; registration never asked for one.
- **Suggested fix:** either keep as-is (fine for a password-only club — just stop showing the field anywhere), or make email optional-but-real at signup for future use (password reset, event notifications). Do **not** leave it in-between: a fake column that looks real is what caused 2.1's ambiguity.

### 2.4 Admins are defined by an env var — `open`
- **Severity:** 🟡 today, 🟠 at hackathon scale
- **Symptom:** `isAdmin()` checks `ADMIN_USER_IDS` from `.env`. Granting/revoking admin requires SSH-level access + server restart. The frontend "Invites" button additionally probes `/api/invites` and hides on 403 — a roundabout way to learn your own role.
- **Root cause:** env-based admin was inherited from the old custom-emoji handler and reused for invites.
- **Suggested fix:** move to a persistent `users.is_admin` boolean (or a roles table), seeded from `ADMIN_USER_IDS` on first boot only. Expose `is_admin` on `GET /api/me` so the frontend stops probing. Bonus: lets the redesign add per-event organizer roles, which a hackathon/CTF server will need (`role: member | organizer | admin`, `team roles` underneath).

### 2.5 First-admin bootstrap is awkward — `open`
- **Severity:** 🟠
- **Symptom:** registration *requires an invite code*, but generating codes requires being an admin — the very first admin can't be created through the app. README documents granting yourself via `ADMIN_USER_IDS=1` + a manual SQL insert (what the local dev setup does).
- **Root cause:** chicken-and-egg between the invite gate and the admin list.
- **Suggested fix:** implement a one-time bootstrap rule in `RegisterHandler`: `if COUNT(users) == 0 → first registered account becomes admin, invite code still required from env `BOOTSTRAP_INVITE_CODE` (or printed once to server logs at startup)`. This removes the manual SQL step and is self-documenting.

### 2.6 No rate limiting on auth endpoints — `open`
- **Severity:** 🟠
- **Symptom:** `POST /api/auth/login` and `/api/auth/register` can be hammered unthrottled → trivial password brute-force against bcrypt hashes of weak passwords.
- **Root cause:** no limiter middleware was added when the password endpoints were introduced.
- **Suggested fix:** a small per-IP+per-username token-bucket middleware (e.g. 5 login attempts/min, 3 register attempts/hour/IP). Gin has ready-made community middleware; ~30 lines hand-rolled is also fine. Also consider exponential lockout per username after N failures.

---

## 3. Invites

### 3.1 Invite expiry is scaffolded but unreachable — `open`
- **Severity:** 🟡
- **Symptom:** `InviteCode.ExpiresAt` exists and redemption checks it — but neither `POST /api/invites` nor the invites modal lets anyone *set* an expiry. Codes are effectively immortal until used/deleted.
- **Root cause:** model field was written ahead of the feature; the create path never caught up.
- **Suggested fix:** accept optional `expires_at` (or a `ttl_hours` number) in `POST /api/invites` (admin-only, easy) and surface it in the invites modal. For a CTF server this matters: invite windows around event weekends.

### 3.2 Used-invite history is unbounded and unmanaged — `open`
- **Severity:** 🟡
- **Symptom:** every consumed invite stays in the admin list forever (`used invites cannot be deleted` by design); no pagination in `ListInvites` or in the modal.
- **Root cause:** the "who joined via which code" audit trail is valuable but was never given a home beyond one flat list.
- **Suggested fix:** order + paginated rows endpoint, and/or an archive toggle. Honest alternative for a tiny club: allow deleting *used* invites too and keep the audit trail in the users table (`joined_via_invite_id` column) instead.

---

## 4. Forum

### 4.1 Threads and posts cannot be deleted or edited — `open`
- **Severity:** 🟠 — the biggest moderation gap
- **Symptom:** no `DELETE /api/threads/:id`, no post edit/delete anywhere. A typo'd title or leaked secret (relevant for CTFs!) is permanent for everyone.
- **Root cause:** the old app never needed moderation; nothing was removed during the rebuild.
- **Suggested fix:** implement `DELETE /api/threads/:id` and `DELETE /api/threads/:threadId/posts/:postId` with permission rules: author (soft-delete) or admin; cascade stays on via GORM constraints. For a server hosting CTFs, add `POST /api/threads/:id/pin` and unpin (organizer tooling) in the same pass.

### 4.2 Thread list is non-debounced and single-page forever — `open`
- **Severity:** 🟡
- **Symptom:** the forum fires a request on *every keystroke* of the search box (`useEffect` keyed on raw `search` state) and only ever loads page 1; there is no pagination UI, infinite scroll, or "load more". >50 threads would be silently invisible.
- **Root cause:** page was written for a tiny member base; `ListThreads` supports `page`/`limit` server-side but this was never wired.
- **Suggested fix:** 300 ms debounce in the page component + a `page` state + either "Load more" button or infinite scroll consuming `page/limit`.

### 4.3 Thread list is heavy: full preloads per row — `scale-watch`
- **Severity:** 🟡 (invisible until real volume)
- **Symptom:** `database.ListThreads` preloads `Posts.User`, `Reactions.User`, `Images` for every listed thread, i.e. the list endpoint is O(threads × members) rows serialized per call. In the forum UI only counts + a 2-line excerpt are actually rendered.
- **Root cause:** the list and detail endpoints share the same "load everything" query shape.
- **Suggested fix:** add a lean list projection (`id, title, excerpt, author, counts`) after the redesign lands — do it in the same pass as 4.2 rather than by itself.

### 4.4 Thread image captions are stored but unsettable — `open`
- **Severity:** 🟡
- **Symptom:** `ThreadImage.Caption` exists and is returned by the API; the create modal never asks for captions and the detail view renders `img.caption || ""` into an alt attribute only.
- **Root cause:** dead field from pre-rename UI that supported captions.
- **Suggested fix:** either drop the caption column/UI ambition or accept an optional `caption` per image in `POST /api/threads` (form data). Fine to keep `parked` until the redesign decides on gallery UX.

### 4.5 Reaction set is limited to the quick six — `mostly fixed 2026-11-07`
- **Severity:** 🟡
- **Symptom (was):** thread reactions only accepted the six hardcoded emoji, while `CustomEmoji` (admin-uploaded emoji pack) existed but was wired to nothing.
- **Fixed:** the backend validator (`isValidEmoji` in `reactions.go`) now accepts any short emoji-like payload (markup/control chars rejected), and the thread entry UI ships a reaction picker — a curated extended set plus a free-entry slot for literally any emoji. Aggregation is fully dynamic, grouped by whatever emoji an entry actually has.
- **Remaining:** admin-uploaded *custom emoji images* (the emoji pack as reactions) are still unwired — needs an image-emoji resolver for names/ids in `ThreadReaction.Emoji` and a hub-side frame for chat reactions (see 5.4).

---

## 5. Chat

### 5.1 No auto-reconnect on the WebSocket — `open`
- **Severity:** 🟠
- **Symptom:** if the Go server restarts mid-session (or wifi blips), the chat badge flips to `connecting…` and *stays* dead until the user hard-navigates. The hook closes with no retry.
- **Root cause:** `useChatWebSocket` in `lib/ws.ts` has no reconnect loop — a deliberate simplification.
- **Suggested fix:** exponential backoff reconnect in the hook (e.g. 1s → 2s → 4s → cap 30s, jittered, reset on successful open, abort on unmount). Also fetch history once more on each reconnect to heal the gap.

### 5.2 Message gap on reconnect / race between history and live frames — `open`
- **Severity:** 🟡
- **Symptom:** history (`GET /chatrooms/:id/history`) and live WS frames are two independent sources; the hook dedupes by `id` during merges, but a message sent between "history fetched" and "WS open" is lost until refresh. Room membership also changes while `messages === null` is displayed.
- **Root cause:** no ordering handshake between REST and WS.
- **Suggested fix:** piggyback on the 5.1 reconnect re-fetch. Longer term: include the last-seen message id as a `since` param on history fetch and let the hub replay from memory (it already holds per-room buffers).

### 5.3 Presence is a count, not a roster — `open`
- **Severity:** 🟡
- **Symptom:** room list shows an `active_users` number; inside a room you never see *who* is online, and the count only refreshes when the list endpoint is re-called (full page fetch — no live update while sitting in the sidebar).
- **Root cause:** hub tracks client sets in memory but only exposes an aggregate through the REST list route.
- **Suggested fix:** broadcast a `presence {usernames[]}` frame on join/leave per room and show dots/avatars in the room header. Cheap, high coziness value.

### 5.4 Chat messages can't be deleted, and reactions are missing entirely — `open`
- **Severity:** 🟡 / leftover feature
- **Symptom:** `ChatMessage` model preloads `Reactions []MessageReaction` and the TS type carries them, but there are **zero routes** to add/remove message reactions and no UI. Chat deletion also doesn't exist.
- **Root cause:** the message-reaction feature was scaffolded (model + serialization + frontend type) and never finished.
- **Suggested fix:** mirror the thread-reaction handlers (`POST/DELETE /api/chatrooms/:roomId/messages/:messageId/reactions[/:emoji]`) — the reaction table and validation code can be reused almost verbatim. Then broadcast a `message_reactions` WS frame. Blocks nothing.

### 5.5 Typing indicator has no server-side timeout — `open`
- **Severity:** 🟡
- **Symptom:** the client clears a typing name after 2.5 s locally, but the hub itself never times out typing state; if a client's socket dies unnaturally without `user_left`, ghost "…is typing" can persist for other clients until that client's next frame (the code does clear names on receiving `new_message` from that user, and `user_left` clears all — that's the only mitigation).
- **Root cause:** typing timeout was pushed entirely client-side.
- **Suggested fix:** acceptable to leave as is; if it ever flickers in practice, add a hub-side timestamped map and prune on a 3 s tick before broadcasting.

### 5.6 WS token travels in the query string — `scale-watch`
- **Severity:** 🟡
- **Symptom:** `GET /chatrooms/:id/ws?token=<JWT>` — the access token ends up in access logs and proxy logs; browsers keep it in history.
- **Root cause:** browsers can't set `Authorization` on `new WebSocket()`, so the middleware accepts query auth.
- **Suggested fix:** fine to keep locally. For the real deployment: short-lived single-use tokens for WS upgrades (the refresh-token plumbing already knows how to mint/consume such tokens) or pass JWT via the `Sec-WebSocket-Protocol` header.

---

## 6. Admin features

### 6.1 `/reports/*` is a dead mount site — `open`
- **Severity:** 🟡
- **Symptom:** the Go server statically serves `./reports/public` at `/reports` — leftovers of the old club-report website (a `reports/` dir with `bin/`, `config/`, `content/`, `layouts/`, and an empty-ish `public/` still lives in the repo root). Nothing in the app links to it.
- **Root cause:** deleted feature, undeleted directory and route.
- **Suggested fix:** remove `r.Static("/reports", "./reports/public")` and archive the `reports/` folder (or just delete both — nothing references them). Low effort, removes confusion now that the app identity changed.

### 6.2 Custom emoji pack is admin-only with no picker — `parked`
- **Severity:** 🟡
- **Symptom:** admins can `POST/GET/DELETE /api/emojis`, but no UI uploads them, no picker exists in chat or the forum, and reactions ignore them (see 4.5).
- **Root cause:** backend landed early; frontend never caught up.
- **Suggested fix (for the redesign):** emoji picker component in the chat composer + reaction bars; the Invites modal pattern (admin-only probe + gate) is reusable for the management UI. Only worth doing if the club actually wants a meme economy.

### 6.3 Admin surface ends at invites — `open` (redesign input)
- **Severity:** 🟠 in the context of hackathons/CTFs
- **Symptom:** the only admin powers are invites and emojis. There is no members list, no moderation, no events, no teams, no challenges whatever.
- **Root cause:** out of scope until now — the redesign is explicitly about this gap.
- **Suggested fix:** that *is* the redesign. Minimum base layer to survive as "hidden server": members list with roles, content moderation (deletes, 4.1), and (per your vision) events → teams → challenges underneath.

---

## 7. Frontend gaps

### 7.1 Profile "Preferences" (social links) stored but unreachable — `open`
- **Severity:** 🟡
- **Symptom:** `User.Preferences` (JSON social-links map) migrates, serializes, and takes up schema — but the profile editor has no social-fields UI, the API accepts nothing for it, and no view displays it.
- **Root cause:** column survived the model cleanup; the UI for it did not.
- **Suggested fix:** drop the column, or finish the story (3–4 fixed link slots — GitHub/Discord/Twitter — in profile edit + peek modal). For a hackathon server, GitHub links on profiles will matter — so I'd *finish* it then, in the redesign.

### 7.2 No global error/toast layer — `open`
- **Severity:** 🟡
- **Symptom:** failures are handled inconsistently: modals show inline error banners, the chat *room creator* and invites modal use `alert()`, and the `/` gate silently swallows the refresh-check exception.
- **Root cause:** no shared toast/notification component exists in the small UI kit.
- **Suggested fix:** one tiny toast store (Zustand) + `<Toaster />` mounted in the app layout; replace `alert()` calls; surface gate errors as a message.

### 7.3 User-peek modal shows almost nothing — `open`
- **Severity:** 🟡
- **Symptom:** clicking a username opens a peek with avatar/name/bio only — no joining date, no shared events/teams, and social links (7.1) wouldn't show even if they existed.
- **Root cause:** deliberate simplification of a cohesive redesign later.
- **Suggested fix:** enrich after the redesign settles — e.g. badges for organizer/admin, event participation. Fold into whatever the member-profile redesign becomes.

### 7.4 Strict-mode effect dependency suppressions — `open`
- **Severity:** 🟡
- **Symptom:** `forum/page.tsx` and `threads/[id]/page.tsx` contain a deliberately-ignored ESLint rule: `useEffect(..., [useAuth.getState().token])` — reading a store outside React's subscription; a token *renewal* will refetch the list (good), but an expired-token fetch during mount can render stale-not-found before the gate redirects.
- **Root cause:** token identity was used as a cheap cache key.
- **Suggested fix (post-redesign):** make data loaders lifespan-bound to the Zustand store (a `useThreadList()` hook that subscribes outright), or trigger loads in the layout once authenticated. Cosmetic for now, but will become a source of flicker once interceptors/refresh added multi-step failure paths.

### 7.5 Zero optimistic UI — `parked`
- **Severity:** 🟡
- **Symptom:** every mutation (thread creation, reply, reaction toggle, event reactions) awaits the server *then* refetches the whole resource. Threads detail refetches the full thread on every reaction tap.
- **Root cause:** kept deliberately unfancy during the rebuild.
- **Suggested fix:** fine for a cozy club; revisit only if the redesign introduces fast-paced UX (CTF challenge reactions, live scoreboards). Reaction toggles can be made optimistic in 5 minutes each — cheap when needed.

---

## 8. Security & ops notes (for the real deployment)

### 8.1 No HTTPS story — `open`
- **Severity:** 🟠
- **Symptom:** dev runs HTTP on loopback; the CORS allowlist and WS base URLs support HTTPS origins but nothing terminates TLS. Refresh cookies need `Secure` in production — the code sets `Secure` *conditionally* on `SameSite`-matching, verify at deploy.
- **Root cause:** local-only execution until now.
- **Suggested fix:** a boring, known-working option: reverse proxy (Caddy/nginx) in front of both Next (:3000) and Go (:5070), `APP_ORIGIN` set to the club domain, HTTPS auto-issued. Put it in the redesign deployment notes.

### 8.2 Uploads have no explicit size cap — `open`
- **Severity:** 🟡
- **Symptom:** `/api/upload/avatar` and `/api/upload/image` validate content-type by magic bytes (good) but do not set a body limit — only Gin's default global max request (32 MB) applies.
- **Root cause:** the old limit never got re-tightened after the handler swaps.
- **Suggested fix:** explicit `c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 5<<20)` per upload route (or a route-group middleware) *and* reject with a friendly 413 instead of the opaque router failure. Client-side advisory limit too (input accept already exists).

### 8.3 Upload dirs grow unbounded — `scale-watch`
- **Severity:** 🟡
- **Symptom:** `uploads/{avatars,images,emojis}` accumulate everything ever uploaded with no reconciliation; deleted threads leave orphaned files behind.
- **Root cause:** disk storage was chosen deliberately; no GC was written.
- **Suggested fix:** fine indefinitely at club scale. If it matters later: filename store per-model and a nightly sweep of unreferenced files. Not worth a cron job before the redesign lands.

### 8.4 JWT secret is env-only — `open`
- **Severity:** 🟡
- **Symptom:** `JWT_SECRET` is required at boot; if it leaks there is no rotation story beyond restarting with a new value (kills all sessions at once, including refresh tokens? — refresh tokens are DB-backed, so access tokens go invalid and refresh survives — actually acceptable).
- **Root cause:** standard practice so far.
- **Suggested fix:** document "restart rotates sessions" as the incident runbook; optionally add `kid`-based dual-key acceptance if you ever need zero-downtime rotation.

### 8.5 Accessibility & responsive gaps — `open`
- **Severity:** 🟡
- **Symptom:** custom modals have no focus trap, no `aria-modal`, no Escape-key close; emoji buttons rely on `aria-label` (good) but reaction bars are plain buttons without radio/pressed semantics; color contrast of `greyple` on `void` sits near 4.5:1 for small text. Mobile chat pane works, forum long-list scroll isn't virtualized (irrelevant at this size).
- **Root cause:** hand-rolled modals with no a11y library (deliberate, keeps 0-runtime-deps budget).
- **Suggested fix:** low-cost patch pass on `Modal` (focus trap + Escape + `aria-modal` + return focus). Everything else as encountered in the redesign's normal a11y sweep.

---

## 9. Cumulative picture

| Area | Working | Half-baked | Missing |
|---|---|---|---|
| Identity & membership | login/signup/refresh/logout, bcrypt, invite gate | Google path (bypass, 2.1), first-admin bootstrap (2.5), no password change (2.2) | roles in DB (2.4), email reality (2.3), rate limit (2.6) |
| Invites | create/list/delete, atomic consumption | expiry unused (3.1), history unbounded (3.2) | — |
| Forum | threads, posts, images, reactions, search | moderation absent (4.1), list perf (4.3, 4.2), captions (4.4) | pinning, edit, pagination UI |
| Chat | rooms, live WS, history, presence count, typing | reconnect (5.1), gap healing (5.2), reactions (5.4) | roster presence (5.3), message delete |
| Admin | invites + emoji CRUD via env IDs | emoji picker missing (6.2), dead `/reports` (6.1) | members/moderation/events/teams/challenges (6.3) |
| Frontend | 6 routes, coherent design system, no-auth-gate leaks | toasts (7.2), peek modal (7.3), effects (7.4), social links (7.1) | optimistic UI (7.5), a11y polish (8.5) |
| Ops | trust proxies, CORS, login rate-limit-less, magic-byte uploads | HTTPS (8.1), upload cap (8.2) — | rotation runbook (8.4), uploads GC (8.3) |

**Priority order if you're fixing *only* before the redesign:**
1. **5.1 (WS reconnect)** — the single most user-visible reliability hole today.
2. **2.5 (first-admin bootstrap)** — makes the app self-installable; unblocks real deployments.
3. **2.1 (Google bypass)** — 15-minute fix, closes a gate hole forever.
4. **4.1 (thread/post deletion)** — becomes critical the moment real people share real content.
5. **2.6 (rate limit)** — needed before the first real deploy.
