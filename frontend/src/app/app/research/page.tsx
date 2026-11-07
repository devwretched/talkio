"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/time";
import { useAuth } from "@/lib/auth";
import { Display, Eyebrow, Meta, Reveal, Rule, Serif, GhostButton, PrimaryButton } from "@/components/veil/typography";
import { ThreadCreateModal } from "@/components/thread-create-modal";
import { InvitesButton } from "@/components/invites";
import { type Thread } from "@/types";

/**
 * RESEARCH — the forum as an independent technical publication index.
 * Editorial listing rows (no social cards), with a featured lead row.
 */

export default function ResearchPage() {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // Debounced search: the payload is heavy, the keystroke shouldn't be.
  const [query, setQuery] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useMemo(
    () => async (q: string) => {
      try {
        setError(null);
        setThreads(await api.get<Thread[]>(`/api/threads${q ? `?search=${encodeURIComponent(q)}` : ""}`));
      } catch (err) {
        setError((err as { message?: string }).message || "Archive unreachable.");
      }
    },
    [],
  );

  useEffect(() => {
    load(query);
  }, [query, load, useAuth.getState().token]); // eslint-disable-line react-hooks/exhaustive-deps

  const [lead, ...rest] = threads ?? [];

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 md:px-10 md:py-14">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow index="03">RESEARCH — PUBLISHED THREADS</Eyebrow>
            <h1 className="mt-3">
              <Display className="text-5xl text-bone md:text-7xl">THE ARCHIVE</Display>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <InvitesButton />
            <GhostButton onClick={() => setCreateOpen(true)}>＋ New entry</GhostButton>
          </div>
        </div>
        <Rule className="mt-6" />
      </Reveal>

      <Reveal delay={0.08}>
        <div className="mt-6 flex items-center justify-between gap-6">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="grep the archive…"
            className="input-veil max-w-sm font-mono text-sm"
            aria-label="Search threads"
          />
          <Meta>{threads ? (query ? `${threads.length} matches` : `${threads.length} on record`) : "…"}</Meta>
        </div>
      </Reveal>

      {error && (
        <p className="mt-6 border-l-2 border-oxide bg-burgundy/20 py-2 pl-3 font-mono text-[11px] text-ivory">{error}</p>
      )}

      {threads === null ? (
        <div className="mt-10"><SkeletonRows n={5} /></div>
      ) : threads.length === 0 ? (
        <Reveal delay={0.1}>
          <div className="py-20 text-center">
            <Serif className="text-xl italic text-ash">
              {query ? "Nothing in the archive matches. Try different phrasing." : "The archive is empty. Publish the first entry."}
            </Serif>
          </div>
        </Reveal>
      ) : (
        <ol className="mt-10">
          {/* Featured lead: oversized editorial treatment, only when unfiltered */}
          {!query && lead && (
            <Reveal delay={0.1}>
              <li className="border-b border-line/60 pb-8">
                <Link href={`/app/research/threads/${lead.id}`} className="group block">
                  <Meta>FIRST ON RECORD · <span className="text-ash">@{lead.user?.username}</span> · {timeAgo(lead.created_at)}</Meta>
                  <h2 className="mt-2 font-display text-4xl leading-[0.95] text-bone transition-colors group-hover:text-white md:text-6xl">
                    {lead.title}
                  </h2>
                  {lead.posts?.[0]?.content && (
                    <p className="mt-3 max-w-2xl font-editorial text-lg italic leading-relaxed text-ivory/85">
                      {lead.posts[0].content.length > 190 ? `${lead.posts[0].content.slice(0, 190)}…` : lead.posts[0].content}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-5 font-mono text-[10px] uppercase tracking-[0.16em] text-dim">
                    <span>{lead.posts?.length ?? 0} REPLIES</span>
                    <span>{lead.reactions?.length ?? 0} REACTIONS</span>
                    {(lead.images?.length ?? 0) > 0 && <span className="text-oxide">{lead.images!.length} IMAGES</span>}
                  </div>
                </Link>
              </li>
            </Reveal>
          )}

          {(query ? threads : rest).map((t, i) => (
            <ResearchRow key={t.id} thread={t} index={i + (query ? i : 1)} />
          ))}
        </ol>
      )}

      <ThreadCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(t) => {
          setThreads((prev) => (prev ? [t, ...prev] : [t]));
          setCreateOpen(false);
        }}
      />
    </div>
  );
}

function ResearchRow({ thread, index }: { thread: Thread; index: number }) {
  return (
    <li className="border-b border-line/40 last:border-b-0">
      <Link
        href={`/app/research/threads/${thread.id}`}
        className="group row-focus grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-3 px-1 py-4 transition-colors md:gap-5"
      >
        <span className="font-mono text-[10px] text-dim group-hover:text-oxide">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-display text-xl leading-tight text-ivory group-hover:text-bone md:text-2xl">
            {thread.title}
          </span>
          <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
            @{thread.user?.username} · {timeAgo(thread.created_at)}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-4 font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
          {(thread.images?.length ?? 0) > 0 && <span className="text-oxide">{thread.images!.length} IMG</span>}
          <span>{thread.posts?.length ?? 0} R</span>
          <span>{thread.reactions?.length ?? 0} %</span>
        </span>
      </Link>
    </li>
  );
}

function SkeletonRows({ n }: { n: number }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-5">
          <div className="h-2 w-6 bg-elev" />
          <div className="h-4 max-w-md bg-elev" />
          <div className="h-2 w-24 bg-elev" />
        </div>
      ))}
    </div>
  );
}
