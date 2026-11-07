"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/time";
import { useAuth } from "@/lib/auth";
import { Display, Eyebrow, Meta, Reveal, Rule, Serif } from "@/components/veil/typography";
import { type Chatroom, type Thread } from "@/types";

/**
 * COMMAND — the collective's daily intelligence read. Real data only:
 * the latest research threads and live room presence from the existing APIs.
 */

export default function CommandPage() {
  const user = useAuth((s) => s.user);
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [rooms, setRooms] = useState<Chatroom[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [t, r] = await Promise.all([
          api.get<Thread[]>("/api/threads"),
          api.get<Chatroom[]>("/api/chatrooms"),
        ]);
        if (!cancelled) {
          setThreads(t);
          setRooms(r);
        }
      } catch (err) {
        if (!cancelled) setError((err as { message?: string }).message || "Network unavailable.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [useAuth.getState().token]); // eslint-disable-line react-hooks/exhaustive-deps

  const liveSum = (rooms ?? []).reduce((acc, r) => acc + (r.active_users ?? 0), 0);
  const latest = (threads ?? []).slice(0, 5);
  const hotRooms = [...(rooms ?? [])].sort((a, b) => (b.active_users ?? 0) - (a.active_users ?? 0)).slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 md:px-10 md:py-14">
      {/* ── Headline ── */}
      <Reveal>
        <Eyebrow index="01">COMMAND — DAILY READ</Eyebrow>
        <h1 className="mt-5">
          <Display className="block text-6xl text-bone md:text-8xl">
            THE NETWORK <span className="text-oxide">IS</span> ALIVE.
          </Display>
        </h1>
        <p className="mt-4 max-w-lg font-editorial text-xl italic text-ivory md:text-2xl">
          An independent environment for research, competition and collaboration.
        </p>
      </Reveal>

      <Reveal delay={0.08}>
        <div className="mt-8 flex flex-wrap items-baseline gap-x-8 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
          <span>OPERATOR · <span className="text-ash">{user?.username ?? "—"}</span></span>
          <span>STARDATE · <span className="text-ash">{new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date())}</span></span>
          <span>REGISTRY · <span className="text-ash">INVITATION ONLY</span></span>
        </div>
        <Rule className="mt-5" />
      </Reveal>

      {/* ── Live figures ── */}
      <Reveal delay={0.14}>
        <div className="grid grid-cols-3 divide-x divide-line/70 border border-line/60 bg-coal/40">
          <Figure label="LIVE IN FREQUENCIES" value={rooms ? liveSum : null} accent />
          <Figure label="ROOMS" value={rooms ? rooms.length : null} />
          <Figure label="THREADS IN VIEW" value={threads ? threads.length : null} />
        </div>
      </Reveal>

      {error && (
        <p className="mt-6 border-l-2 border-oxide bg-burgundy/20 py-2 pl-3 font-mono text-[11px] text-ivory">{error}</p>
      )}

      {/* ── Editorial grid ── */}
      <div className="mt-12 grid gap-12 lg:grid-cols-12">
        {/* Latest research — 7/12 */}
        <Reveal delay={0.2} className="lg:col-span-7">
          <section>
            <Eyebrow index="03">LATEST RESEARCH</Eyebrow>
            <Rule className="mt-3" />
            {threads === null ? (
              <SkeletonRows n={4} />
            ) : latest.length === 0 ? (
              <p className="py-10 font-editorial text-lg italic text-ash">
                The archive is silent. Open the first line of investigation in RESEARCH.
              </p>
            ) : (
              <ol>
                {latest.map((t, i) => (
                  <li key={t.id} className="border-b border-line/50 last:border-b-0">
                    <Link href="/app/research" className="group row-focus block py-4 pr-2 transition-colors">
                      <span className="flex items-baseline gap-4">
                        <span className="font-mono text-[10px] text-dim group-hover:text-oxide">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-display text-xl leading-tight text-bone transition-colors group-hover:text-white md:text-2xl">
                            {t.title}
                          </span>
                          <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-dim">
                            @{t.user?.username} · {timeAgo(t.created_at)} · {t.posts?.length ?? 0} R · {t.reactions?.length ?? 0} %
                          </span>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
            <Link
              href="/app/research"
              className="mt-4 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ash transition-colors hover:text-bone"
            >
              Full archive → <span className="text-oxide">03</span>
            </Link>
          </section>
        </Reveal>

        {/* Frequencies + operations — 5/12 */}
        <Reveal delay={0.26} className="lg:col-span-5">
          <section>
            <Eyebrow index="04">FREQUENCIES</Eyebrow>
            <Rule className="mt-3" />
            {rooms === null ? (
              <SkeletonRows n={3} />
            ) : hotRooms.length === 0 ? (
              <p className="py-8 font-editorial text-lg italic text-ash">No rooms broadcasting. Open one in FREQUENCY.</p>
            ) : (
              <ol>
                {hotRooms.map((r) => (
                  <li key={r.id}>
                    <Link
                      href="/app/frequency"
                      className="group row-focus flex items-center justify-between border-b border-line/50 py-3 last:border-b-0"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={(r.active_users ?? 0) > 0 ? "h-1.5 w-1.5 bg-oxide" : "h-1.5 w-1.5 bg-line"} />
                        <span className="truncate font-mono text-sm text-ivory group-hover:text-bone">{r.name}</span>
                      </span>
                      <Meta>{r.active_users ?? 0} ON</Meta>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
            <Link
              href="/app/frequency"
              className="mt-4 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ash transition-colors hover:text-bone"
            >
              All frequencies → <span className="text-oxide">04</span>
            </Link>
          </section>

          <section className="mt-12">
            <Eyebrow index="02">OPERATIONS</Eyebrow>
            <Rule className="mt-3" />
            <div className="panel mt-4 p-5">
              <Serif className="text-[15px] italic leading-relaxed text-ivory">
                The competition system — CTFs, hackathons, leaderboards — is under construction. No live operations
                are on the board. <span className="not-italic font-mono text-[10px] uppercase tracking-[0.16em] text-oxide">Preview the structure → 02</span>
              </Serif>
            </div>
          </section>
        </Reveal>
      </div>

      {/* ── Footer statement ── */}
      <Reveal delay={0.32}>
        <Rule className="mt-16" />
        <Serif className="mt-6 block max-w-2xl text-xl italic leading-relaxed text-ivory/90">
          “Nothing here is decoration. The veil exists so the work can happen out of sight.”
        </Serif>
      </Reveal>
    </div>
  );
}

function Figure({ label, value, accent }: { label: string; value: number | null; accent?: boolean }) {
  return (
    <div className="px-4 py-5 md:px-6">
      <p className="font-display text-5xl leading-none md:text-6xl">
        <span className={accent ? "text-oxide" : "text-bone"}>{value ?? "—"}</span>
      </p>
      <Meta className="mt-2 block text-dim">{label}</Meta>
    </div>
  );
}

function SkeletonRows({ n }: { n: number }) {
  return (
    <div className="space-y-4 py-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-baseline gap-4">
          <div className="h-2 w-6 bg-elev" />
          <div className="h-4 flex-1 bg-elev" />
          <div className="h-2 w-16 bg-elev" />
        </div>
      ))}
    </div>
  );
}
