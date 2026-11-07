"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/time";
import { useAuth } from "@/lib/auth";
import { Display, Eyebrow, Meta, Reveal, Rule, Serif } from "@/components/veil/typography";
import { UserProfileModal } from "@/components/profile-settings";
import { ReactionPicker } from "@/components/emoji-picker";
import { REACTIONS, type Thread, type User } from "@/types";
import { resolveAssetUrl } from "@/lib/utils";

/**
 * RESEARCH — single entry. Long-form, comfortable, distraction-free reading
 * with a full-width typocratic title, image gallery, reactions and replies.
 */

export default function ThreadDetailPage() {
  const params = useParams<{ id: string }>();
  const threadId = Number(params.id);

  const [thread, setThread] = useState<Thread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [pending, setPending] = useState(false);
  const [profileUser, setProfileUser] = useState<User | null>(null);

  const refresh = async () => {
    try {
      setThread(await api.get<Thread>(`/api/threads/${threadId}`));
    } catch (err) {
      setError((err as { message?: string }).message || "Entry not found.");
    }
  };

  useEffect(() => {
    if (threadId) refresh();
  }, [threadId, useAuth.getState().token]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setPending(true);
    try {
      await api.post(`/api/threads/${threadId}/posts`, { content: reply.trim() });
      setReply("");
      await refresh();
    } catch (err) {
      setError((err as { message?: string }).message || "Failed to post reply.");
    } finally {
      setPending(false);
    }
  };

  const me = useAuth((s) => s.user);
  const myId = me?.id;
  const [pickerOpen, setPickerOpen] = useState(false);

  // Aggregate reactions per emoji over everything the entry actually has
  // (any emoji, quick-picks or custom picks), tracking whether I reacted.
  const counts = useMemo(() => {
    if (!thread?.reactions) return [] as { emoji: string; count: number; mine: boolean }[];
    const byEmoji = new Map<string, { emoji: string; count: number; mine: boolean }>();
    for (const r of thread.reactions) {
      const c = byEmoji.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
      c.count += 1;
      if (r.user_id === myId) c.mine = true;
      byEmoji.set(r.emoji, c);
    }
    const all = [...byEmoji.values()];
    // Stable, legible order: quick picks in canonical order, then the rest by weight.
    const quick = REACTIONS
      .map((e) => all.find((c) => c.emoji === e))
      .filter((c): c is { emoji: string; count: number; mine: boolean } => !!c);
    const rest = all
      .filter((c) => !REACTIONS.includes(c.emoji as (typeof REACTIONS)[number]))
      .sort((a, b) => b.count - a.count);
    return [...quick, ...rest];
  }, [thread?.reactions, myId]);

  const toggleReaction = async (emoji: string, mine: boolean) => {
    try {
      if (mine) await api.delete(`/api/threads/${threadId}/reactions/${encodeURIComponent(emoji)}`);
      else await api.post(`/api/threads/${threadId}/reactions`, { emoji });
      await refresh();
    } catch (err) {
      setError((err as { message?: string }).message || "Reaction failed.");
    }
  };

  if (error && !thread) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-start justify-center px-5">
        <Serif className="text-xl italic text-ash">{error}</Serif>
        <Link href="/app/research" className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-ash hover:text-bone">
          ← Back to the archive
        </Link>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <div className="space-y-4">
          <div className="h-12 w-3/4 bg-elev" />
          <div className="h-4 w-40 bg-elev" />
          <div className="mt-10 space-y-3">
            <div className="h-3 w-full bg-elev" />
            <div className="h-3 w-full bg-elev" />
            <div className="h-3 w-2/3 bg-elev" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 md:px-10 md:py-14">
      <Reveal>
        <Link href="/app/research" className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash transition-colors hover:text-bone">
          ← Archive 03
        </Link>
        <Eyebrow index="03" className="mt-6">ENTRY {String(thread.id).padStart(3, "0")}</Eyebrow>
        <h1 className="mt-3">
          <Display className="text-4xl text-bone md:text-6xl">{thread.title}</Display>
        </h1>
        <div
          className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2"
          role="group"
          aria-label="Entry metadata"
        >
          <button onClick={() => setProfileUser(thread.user)} className="flex items-center gap-3 text-left">
            <AuthorMark user={thread.user} onOpen={() => setProfileUser(thread.user)} />
          </button>
          <Meta>PUBLISHED · <span className="text-ash">{timeAgo(thread.created_at)}</span></Meta>
        </div>
        <Rule className="mt-6" />
      </Reveal>

      {thread.images?.length ? (
        <Reveal delay={0.08}>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {thread.images.map((img) => (
              <img
                key={img.id}
                src={resolveAssetUrl(img.url)}
                alt={img.caption || ""}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
                className="max-h-96 w-full border border-line object-cover grayscale-[15%]"
              />
            ))}
          </div>
        </Reveal>
      ) : null}

      {/* Reactions */}
      <Reveal delay={0.12}>
        <div className="relative mt-8 flex flex-wrap items-center gap-2 border-y border-line/50 py-4">
          <Meta className="mr-2">React:</Meta>
          {counts.map((c) => (
            <button
              key={c.emoji}
              onClick={() => toggleReaction(c.emoji, c.mine)}
              className={
                "flex items-center gap-1.5 border px-3 py-1.5 font-mono text-xs transition-colors " +
                (c.mine
                  ? "border-oxide bg-burgundy/25 text-bone"
                  : "border-line text-ash hover:border-ash hover:text-bone")
              }
              aria-pressed={c.mine}
              aria-label={`${c.emoji} ${c.count}`}
            >
              <span>{c.emoji}</span>
              <span>{c.count}</span>
            </button>
          ))}
          <button
            onClick={() => setPickerOpen(true)}
            className="border border-dashed border-line px-3 py-1.5 font-mono text-xs text-dim transition-colors hover:border-oxide hover:text-bone"
            aria-label="Add a custom reaction"
          >
            ＋
          </button>
          <ReactionPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={(emoji) => toggleReaction(emoji, false)} />
        </div>
      </Reveal>

      {/* Replies */}
      <section className="mt-12">
        <Eyebrow>REPLIES · {thread.posts?.length ?? 0}</Eyebrow>
        <Rule className="mt-3" />
        <ol className="mt-6 space-y-8">
          {thread.posts?.map((post, i) => (
            <Reveal key={post.id} delay={0.05 + i * 0.03}>
              <li>
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-[10px] text-dim">{String(i + 1).padStart(2, "0")}</span>
                  <button
                    onClick={() => setProfileUser(post.user)}
                    className="font-mono text-xs font-semibold tracking-[0.08em] text-ivory transition-colors hover:text-oxide"
                  >
                    @{post.user?.username}
                  </button>
                  <Meta>{timeAgo(post.created_at)}</Meta>
                </div>
                <p className="mt-2 pl-9 text-[15px] leading-relaxed text-ivory/95">{post.content}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Reply form */}
      <Reveal>
        <form onSubmit={submitReply} className="mt-12 border border-line/60 bg-coal/40 p-5">
          <label htmlFor="reply" className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
            Respond to this entry
          </label>
          <textarea
            id="reply"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write a reply…"
            rows={3}
            required
            className="input-veil mt-2 resize-none text-sm"
          />
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={pending || !reply.trim()}
              className="bg-bone px-6 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink transition-colors hover:bg-white disabled:pointer-events-none disabled:opacity-50"
            >
              {pending ? "sending…" : "Submit reply"}
            </button>
          </div>
        </form>
      </Reveal>

      <UserProfileModal user={profileUser} open={!!profileUser} onClose={() => setProfileUser(null)} />
    </div>
  );
}

function AuthorMark({ user, onOpen }: { user?: User | null; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-3"
      aria-label={`View ${user?.username ?? "author"}`}
    >
      <span className="font-mono text-xs font-semibold tracking-[0.08em] text-bone hover:text-oxide">
        @{user?.username}
      </span>
    </button>
  );
}
