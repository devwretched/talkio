"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Modal, Spinner } from "@/components/ui";
import { timeAgo } from "@/lib/time";

type Invite = {
  id: number;
  code: string;
  used_at?: string | null;
  expires_at?: string | null;
  created_at: string;
  used_by?: { id: number; username: string } | null;
};

/**
 * Admin-only invite manager. The server gates every call to ADMIN_USER_IDS,
 * so this component probes once and hides itself for non-admins.
 * Used members are shown by username only — password hashes are never
 * serialized by the backend.
 */
export function InvitesButton() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Invite[]>("/api/invites")
      .then(() => !cancelled && setIsAdmin(true))
      .catch(() => {
        /* 401/403 → not an operator */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isAdmin) return null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="border border-line px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ash transition-colors hover:border-oxide hover:text-bone"
      >
        Invites
      </button>
      <InvitesModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function InvitesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    setInvites(await api.get<Invite[]>("/api/invites"));
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const create = async () => {
    setCreating(true);
    try {
      await api.post("/api/invites", {});
      await load();
    } catch (err) {
      alert((err as { message?: string }).message || "Failed to create invite");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await api.delete(`/api/invites/${id}`);
      await load();
    } catch (err) {
      alert((err as { message?: string }).message || "Failed to delete invite");
    }
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Operator console · Invite codes">
      <button
        onClick={create}
        disabled={creating}
        className="mb-5 w-full border border-oxide bg-burgundy/30 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-bone transition-colors hover:bg-burgundy/50 disabled:opacity-60"
      >
        {creating ? "generating…" : "＋ Generate code"}
      </button>
      {invites === null ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {invites.length === 0 && (
            <li className="py-4 text-center font-editorial text-base italic text-ash">No codes issued yet.</li>
          )}
          {invites.map((invite) => {
            const used = !!invite.used_at;
            return (
              <li
                key={invite.id}
                className={
                  "flex items-center gap-3 border border-line/60 px-3 py-2.5 " + (used ? "opacity-50" : "bg-elev/40")
                }
              >
                <code className="font-mono text-sm font-semibold tracking-[0.2em] text-bone">{invite.code}</code>
                <span className="flex-1 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-dim">
                  {used && invite.used_by ? `consumed by @${invite.used_by.username}` : `unused · issued ${timeAgo(invite.created_at)}`}
                </span>
                {used ? (
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-oxide">used</span>
                ) : (
                  <>
                    <button
                      onClick={() => copy(invite.code)}
                      className="font-mono text-[9px] uppercase tracking-[0.18em] text-ash hover:text-bone"
                    >
                      {copied === invite.code ? "copied" : "copy"}
                    </button>
                    <button
                      onClick={() => remove(invite.id)}
                      className="font-mono text-[9px] uppercase tracking-[0.18em] text-oxide hover:text-bone"
                      aria-label="Delete invite"
                    >
                      del
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
