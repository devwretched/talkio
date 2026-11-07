"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * The application shell: a narrow editorial index on the left — numbered
 * sections, hairline separators, an animated active indicator — persistent
 * across every authenticated environment.
 *
 * Mobile collapses to a compact top bar and a bottom index strip; compositions
 * inside pages are expected to adapt, not merely shrink.
 */

const SECTIONS = [
  { n: "01", label: "COMMAND", href: "/app/command" },
  { n: "02", label: "OPERATIONS", href: "/app/operations" },
  { n: "03", label: "RESEARCH", href: "/app/research" },
  { n: "04", label: "FREQUENCY", href: "/app/frequency" },
  { n: "05", label: "PERSONNEL", href: "/app/personnel" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.token);

  // Session guard: the gate at `/` owns bootstrap; /app/* requires a live token.
  useEffect(() => {
    if (!token) router.replace("/");
  }, [token, router]);

  const active = SECTIONS.find((s) => pathname.startsWith(s.href))?.n ?? null;

  return (
    <div className="min-h-screen">
      {/* ── Top bar ── */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-12 items-center justify-between border-b border-line/60 bg-ink/70 pl-4 pr-4 backdrop-blur-sm md:pl-[104px]">
        <Link href="/app/command" className="font-display text-lg tracking-[0.08em] text-bone md:hidden">
          VEIL
        </Link>
        <span className="hidden md:block">
          {active && <CurrentSection n={active} />}
        </span>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim md:text-ash">
            {ServerDate()}
          </span>
          <span className="flex items-center gap-2" title="uplink">
            <span className="h-1.5 w-1.5 animate-pulse bg-oxide" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ash">secure</span>
          </span>
        </div>
      </header>

      {/* ── Desktop navigation rail: an editorial index ── */}
      <nav className="fixed bottom-0 left-0 top-0 z-40 hidden w-[92px] flex-col border-r border-line/60 bg-ink/70 pt-14 backdrop-blur-sm md:flex">
        <div className="px-6 pb-8 pt-4">
          <span
            className="font-display text-2xl leading-none tracking-[0.08em] text-bone [writing-mode:vertical-rl]"
            style={{ transform: "rotate(180deg)" }}
          >
            VEIL
          </span>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-7">
          {SECTIONS.map((s) => {
            const isActive = pathname.startsWith(s.href);
            return (
              <Link key={s.n} href={s.href} className="group relative flex justify-center">
                {isActive && (
                  <motion.span
                    layoutId="rail-active"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    className="absolute inset-y-[-14px] left-0 w-full border-l border-oxide bg-white/[0.03]"
                  />
                )}
                <span
                  className={cn(
                    "relative flex flex-col items-center gap-1.5 transition-colors",
                    isActive ? "text-bone" : "text-ash group-hover:text-ivory",
                  )}
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                >
                  <span className={cn("font-mono text-[9px] tracking-[0.18em]", isActive ? "text-oxide" : "text-dim")}>
                    {s.n}
                  </span>
                  <span className="font-mono text-[10px] font-medium tracking-[0.28em]">{s.label}</span>
                </span>
              </Link>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-3 border-t border-line/60 py-4">
          <Link href="/app/personnel" aria-label="Your personnel file">
            <Avatar user={user} size={7} />
          </Link>
          <LogoutMono />
        </div>
      </nav>

      {/* ── Mobile bottom index ── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line/70 bg-ink/90 backdrop-blur-md md:hidden">
        {SECTIONS.map((s) => {
          const isActive = pathname.startsWith(s.href);
          return (
            <Link
              key={s.n}
              href={s.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-3 transition-colors",
                isActive ? "text-bone" : "text-ash",
              )}
            >
              <span className={cn("font-mono text-[9px]", isActive ? "text-oxide" : "text-dim")}>{s.n}</span>
              <span className="font-mono text-[8px] tracking-[0.18em]">{s.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Page container + transitions ── */}
      <main className="pl-0 pt-12 pb-[68px] md:pl-[92px] md:pb-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function CurrentSection({ n }: { n: string }) {
  const s = SECTIONS.find((x) => x.n === n)!;
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ash">
      <span className="text-oxide">{s.n}</span> / {s.label}
    </span>
  );
}

/** Ghost logout — mono, quiet. */
export function LogoutMono() {
  const logout = useAuth((s) => s.clear);
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-col items-center">
      {confirming ? (
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
              logout();
              router.replace("/");
            }}
            className="font-mono text-[9px] uppercase tracking-[0.18em] text-oxide hover:text-bone"
          >
            end
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="font-mono text-[9px] uppercase tracking-[0.18em] text-dim hover:text-ash"
          >
            stay
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="font-mono text-[9px] uppercase tracking-[0.18em] text-dim transition-colors hover:text-ash"
        >
          leave
        </button>
      )}
    </div>
  );
}

/** Fixed "now" date string, updated once a minute. */
export function ServerDate() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const fmt = () =>
      new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date());
    setNow(fmt());
    const id = setInterval(() => setNow(fmt()), 60_000);
    return () => clearInterval(id);
  }, []);
  return <>{now}</>;
}
