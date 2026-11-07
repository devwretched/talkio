"use client";

import { cn, resolveAssetUrl } from "@/lib/utils";
import type { User } from "@/types";

export function Avatar({ user, size = 10 }: { user?: User | null; size?: number }) {
  const letter = user?.username?.charAt(0)?.toUpperCase() || "?";
  return (
    <span
      style={{ width: `${size * 4}px`, height: `${size * 4}px` }}
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface font-display text-bone select-none",
        `text-${Math.max(1, Math.floor(size / 2))}`,
      )}
    >
      {user?.avatar ? (
        <img src={resolveAssetUrl(user.avatar)} alt={user.username} className="h-full w-full object-cover" />
      ) : (
        <span className="font-mono text-xs font-semibold text-ivory">{letter}</span>
      )}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn("h-5 w-5 animate-spin border border-line border-t-oxide", className)}
      role="status"
      aria-label="Loading"
    />
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md border border-line bg-coal p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-oxide">{title}</p>
          <button onClick={onClose} className="-mr-2 -mt-1 p-2 font-mono text-xs text-ash transition-colors hover:text-bone" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const inputClass = "input-veil";
