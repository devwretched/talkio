"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Small mono annotation, e.g. `03 / RESEARCH`. */
export function Eyebrow({ index, children, className }: { index?: string; children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ash", className)}>
      {index && <span className="text-oxide">{index}</span>}
      <span>{children}</span>
    </p>
  );
}

/** Hairline editorial divider with a tiny square terminal. */
export function Rule({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)} aria-hidden>
      <div className="h-px flex-1 bg-line" />
      <div className="h-1 w-1 bg-oxide/70" />
    </div>
  );
}

/** Metadata line: timestamps, IDs, statuses — always mono, small, tracked out. */
export function Meta({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-[10px] uppercase tracking-[0.16em] text-ash", className)}>{children}</span>
  );
}

/** Large display heading. */
export function Display({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-display leading-[0.98] tracking-tight", className)}>{children}</span>;
}

/** Editorial serif voice — intros, quotes, long-form body. */
export function Serif({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-editorial", className)}>{children}</span>;
}

/** Staggered content reveal — the house entrance for any content block. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Primary CTA — bone on ink, square, mono-tracked. */
export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-11 items-center justify-center bg-bone px-6 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink transition-colors hover:bg-white disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Accent CTA — oxide, used sparingly for decisive actions. */
export function AccentButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-11 items-center justify-center bg-oxide px-6 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-bone transition-colors hover:bg-[#b8463c] disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Ghost button — hairline border, quiet by design. */
export function GhostButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-11 items-center justify-center border border-line px-5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ivory transition-colors hover:border-bone hover:text-bone disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}
