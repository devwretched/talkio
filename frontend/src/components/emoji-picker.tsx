"use client";

import { useEffect, useRef, useState } from "react";

/** Curated extended set beyond the six quick-picks. */
export const EXTENDED_EMOJI = [
  "💀", "🫡", "🫶", "🧠", "👀", "🛠️", "🧪", "🧲", "🐛", "🚩",
  "🛰️", "🛡️", "🗝️", "🧩", "🐉", "☕", "🍕", "🐈", "⚡", "🌙",
  "🪐", "👁️", "🤖", "🦝", "🦈", "🧿", "🏴", "🥷", "🎯", "📡",
];

function isPlausibleEmoji(s: string) {
  return s.length > 0 && s.length <= 8 && !/[<>/\\]/.test(s) && !/[\x00-\x1f]/.test(s);
}

/**
 * Custom reaction picker — a squared popover with the curated library and a
 * free-entry slot for literally any emoji. Sits beside the quick-pick chips
 * on thread entries.
 */
export function ReactionPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCustom("");
    setError(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, onClose]);

  if (!open) return null;

  const pick = async (emoji: string) => {
    onPick(emoji);
    onClose();
  };

  const submitCustom = () => {
    const emoji = custom.trim();
    if (!isPlausibleEmoji(emoji)) {
      setError(true);
      return;
    }
    pick(emoji);
  };

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-30 mt-2 w-[19rem] border border-line bg-coal p-4 shadow-2xl"
      role="dialog"
      aria-label="Pick a reaction"
    >
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ash">Extended set</p>
      <div className="mt-2 grid grid-cols-10 gap-1">
        {EXTENDED_EMOJI.map((e) => (
          <button
            key={e}
            onClick={() => pick(e)}
            className="flex h-7 w-7 items-center justify-center text-sm transition-colors hover:bg-elev"
            aria-label={`React ${e}`}
          >
            {e}
          </button>
        ))}
      </div>

      <div className="mt-4 border-t border-line/60 pt-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ash">Anything else</p>
        <div className="mt-2 flex gap-2">
          <input
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              setError(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && submitCustom()}
            placeholder="paste any emoji"
            maxLength={8}
            aria-label="Custom emoji"
            className="input-veil py-1.5 font-mono text-sm"
          />
          <button
            onClick={submitCustom}
            className="shrink-0 border border-line px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ash transition-colors hover:border-oxide hover:text-bone"
          >
            add
          </button>
        </div>
        {error && <p className="mt-1.5 font-mono text-[9px] text-oxide">That doesn't parse as an emoji.</p>}
      </div>
    </div>
  );
}
