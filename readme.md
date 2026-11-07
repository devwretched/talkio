# Hearth

A small, invite-only community platform: forum threads with replies and reactions, live chatrooms over WebSockets, and member profiles. Built with a Go backend and a Next.js frontend.

> **Known issues & half-baked workflows:** see [KNOWN-ISSUES.md](./KNOWN-ISSUES.md) for a full audit of bugs, unfinished features, and suggested fixes.

## Features

- **Invite-gated membership**: admins generate invite codes (`ADMIN_USER_IDS`); signing up requires one. Seen usernames, never passwords — password hashes are not serialized, ever.
- **Forum**: create threads (with up to 4 images), reply, react with emoji, search.
- **Live chatrooms**: real-time messages, typing indicators, and presence counts over WebSockets.
- **Profiles**: username, display name, bio, uploaded avatar.
- **Auth**: username + password (bcrypt) with rotating refresh-token families; short-lived JWT access tokens.

## Tech Stack

- **Backend**: Go (Gin, GORM, PostgreSQL, gorilla/websocket, bluemonday)
- **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS v4, Zustand

## Prerequisites

- [Go](https://golang.org/) 1.25+
- [Node.js](https://nodejs.org/) 20+ (22 recommended)
- [PostgreSQL](https://www.postgresql.org/)

## Backend Setup

```bash
cp .env.example .env      # then fill in DB credentials and JWT_SECRET
go mod download
go run cmd/server/main.go # serves http://localhost:5070
```

### Environment variables (backend, project root `.env`)

| Variable | Purpose |
| --- | --- |
| `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` / `DB_PORT` / `DB_SSL_MODE` | PostgreSQL connection |
| `PORT` | Backend port (default 5070) |
| `JWT_SECRET` | Signs access tokens — use a long random string |
| `ADMIN_USER_IDS` | Comma-separated user IDs that can manage invites and custom emojis |
| `APP_ORIGIN` | Production frontend origin for CORS/WebSockets (optional; localhost is always allowed) |
| `GOOGLE_CLIENT_ID` | *Optional* — only if you re-enable the Google login route |

### First admin + first invite

1. Register once via `POST /api/auth/register` — but codes come from admins… so grant yourself: start the server, create a user by running a single SQL insert, **or** set `ADMIN_USER_IDS=1` and use the API directly:

   ```bash
   curl -X POST localhost:5070/api/invites -H "Authorization: Bearer <your-access-token>"
   ```

   Simpler path: temporarily register with a throwaway, put its ID in `ADMIN_USER_IDS`, restart, log in, generate real codes through the **Invites** button in the forum header.

2. Friends sign up at `/` with username + password + the code.

## Frontend Setup

```bash
cd frontend
cp .env.example .env      # NEXT_PUBLIC_GOOGLE_CLIENT_ID optional; WS URL defaults to :5070
npm install
npm run dev               # http://localhost:3000
```

In dev, `/api/*` and `/uploads/*` are rewritten to `BACKEND_URL` (default `http://localhost:5070`); chat connects over the direct WebSocket URL in `NEXT_PUBLIC_WS_URL`.

Production: `npm run build && npm start`, or deploy to Vercel/Netlify with the env vars set.

## API Overview

All routes under `/api`; protected routes require `Authorization: Bearer <access-token>` (WebSocket upgrades may use `?token=`).

- `POST /api/auth/register` — username, password, invite code
- `POST /api/auth/login`, `/api/auth/refresh`, `/api/auth/logout` — session
- `POST/GET /api/threads`, `GET /api/threads/:id`, `POST /api/threads/:id/posts`
- `POST/GET/DELETE /api/threads/:id/reactions[/:emoji]`
- `POST/GET /api/chatrooms`, `GET /api/chatrooms/:id/history`, `GET /api/chatrooms/:id/ws` (WebSocket)
- `POST /api/upload/avatar`, `POST /api/upload/image`
- `POST/GET/DELETE /api/emojis` (admin), `POST/GET/DELETE /api/invites` (admin)

## License

MIT
