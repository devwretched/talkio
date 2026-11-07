"use client";

import Link from "next/link";
import { Display, Eyebrow, Meta, Reveal, Rule, Serif } from "@/components/veil/typography";

/**
 * OPERATIONS — visual foundation for CTFs and hackathons.
 *
 * HONEST STATE: the backend has no competition system yet (see
 * KNOWN-ISSUES.md §6.3), so this environment presents the *structural*
 * language exhibitions will use — poster compositions, status lines, dates —
 * with zero fake interactivity. Everything non-functional is explicitly
 * labelled a preview.
 */

export default function OperationsPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10 md:px-10 md:py-14">
      <Reveal>
        <Eyebrow index="02">OPERATIONS — COMPETITION BOARD</Eyebrow>
        <h1 className="mt-3">
          <Display className="text-6xl text-bone md:text-8xl">BOARD</Display>
        </h1>
        <p className="mt-4 max-w-lg font-editorial text-xl italic text-ivory">
          Capture The Flag. Hackathons. Results, writeups and the names behind them.
        </p>
        <Rule className="mt-6" />
      </Reveal>

      {/* ── Active operations ── */}
      <Reveal delay={0.08}>
        <section className="mt-12">
          <Eyebrow>ACTIVE</Eyebrow>
          <Rule className="mt-3" />
          <div className="mt-6 border border-line/60 bg-coal/40 p-8 text-center md:p-12">
            <Serif className="text-xl italic text-ash">
              No live operations on the board.
            </Serif>
            <Meta className="mt-3 block">THE COMPETITION SYSTEM IS UNDER CONSTRUCTION</Meta>
          </div>
        </section>
      </Reveal>

      {/* ── Upcoming / registration ── */}
      <Reveal delay={0.14}>
        <section className="mt-12">
          <Eyebrow>UPCOMING · REGISTRATION</Eyebrow>
          <Rule className="mt-3" />
          <div className="mt-6 border border-line/60 bg-coal/40 p-8 text-center md:p-12">
            <Serif className="text-xl italic text-ash">Nothing scheduled.</Serif>
            <Meta className="mt-3 block">ANNOUNCEMENTS WILL APPEAR ON THE COMMAND READ</Meta>
          </div>
        </section>
      </Reveal>

      {/* ── Structural language: a clearly-labelled preview ── */}
      <Reveal delay={0.2}>
        <section className="mt-16">
          <div className="flex items-center justify-between">
            <Eyebrow>STRUCTURE PREVIEW</Eyebrow>
            <Meta className="text-oxide">NOT A LIVE OPERATION</Meta>
          </div>
          <Rule className="mt-3" />
          <div className="mt-6 grid gap-px border border-line/60 bg-line/60 md:grid-cols-2">
            <Poster
              no={"001"}
              title={"THE FIRST BREACH"}
              status={"STRUCTURE ONLY"}
              type={"CAPTURE THE FLAG"}
              date={"DATE TBA"}
            />
            <Poster
              no={"002"}
              title={"CIPHER SEASON"}
              status={"STRUCTURE ONLY"}
              type={"HACKATHON"}
              date={"DATE TBA"}
            />
          </div>
          <p className="mt-4 max-w-2xl font-mono text-[10px] leading-relaxed tracking-[0.08em] text-dim">
            THESE ARE LAYOUT SPECIMENS. WHEN EVENT / TEAM / CHALLENGE APIs SHIP, EACH POSTER BECOMES A LIVE RECORD —
            REGISTRATION, TEAMS, LEADERBOARDS AND SUBMISSIONS RENDER IN THIS SAME EDITORIAL LANGUAGE. NO FAKE BUTTONS HERE.
          </p>
        </section>
      </Reveal>

      {/* ── Past operations ── */}
      <Reveal delay={0.26}>
        <section className="mt-16">
          <Eyebrow>PAST · RESULTS & WRITEUPS</Eyebrow>
          <Rule className="mt-3" />
          <p className="py-10 font-editorial text-lg italic text-ash">
            None on record. <span className="text-ivory/80">Writeups live in the <Link href="/app/research" className="underline underline-offset-4 hover:text-bone">archive (03)</Link>.</span>
          </p>
        </section>
      </Reveal>
    </div>
  );
}

/** Exhibition poster — the editorial unit every future competition renders as. */
function Poster({ no, title, status, type, date }: { no: string; title: string; status: string; type: string; date: string }) {
  return (
    <div className="relative bg-ink/80 p-8 md:p-10">
      <div className="flex items-start justify-between">
        <Meta className="text-oxide">OPERATION / {no}</Meta>
        <Meta>{date}</Meta>
      </div>
      <h3 className="mt-8">
        <Display className="text-4xl leading-[0.9] text-bone md:text-5xl">{title}</Display>
      </h3>
      <div className="mt-10 border-t border-line/60 pt-4 font-mono text-[10px] uppercase tracking-[0.18em]">
        <p className="text-ash">
          STATUS · <span className="text-dim">{status}</span>
        </p>
        <p className="mt-1 text-ash">
          TYPE · <span className="text-dim">{type}</span>
        </p>
      </div>
      {/* corner ticks — print registration marks */}
      <span className="absolute left-2 top-2 h-2 w-2 border-l border-t border-line/80" aria-hidden />
      <span className="absolute right-2 top-2 h-2 w-2 border-r border-t border-line/80" aria-hidden />
      <span className="absolute bottom-2 left-2 h-2 w-2 border-b border-l border-line/80" aria-hidden />
      <span className="absolute bottom-2 right-2 h-2 w-2 border-b border-r border-line/80" aria-hidden />
    </div>
  );
}
