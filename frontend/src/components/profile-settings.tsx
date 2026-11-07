"use client";

import { Avatar, Modal } from "@/components/ui";
import { Meta, Serif, Rule, Display } from "@/components/veil/typography";
import type { User } from "@/types";

/**
 * Peer dossier — opens anywhere a handle is shown in the interface.
 * Shows exactly what the API exposes: identity, handle, statement.
 * (Member index, roles and participation history pending backend support —
 * see KNOWN-ISSUES.md §6.3.)
 */
export function UserProfileModal({ user, open, onClose }: { user: User | null; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open && !!user} onClose={onClose} title="Personnel file">
      {user && (
        <div className="space-y-5">
          <div className="flex items-center gap-5">
            <Avatar user={user} size={16} />
            <div className="min-w-0">
              <Display className="block text-3xl leading-[0.95] text-bone">{user.name || user.username}</Display>
              <p className="mt-1 font-mono text-xs tracking-[0.12em] text-oxide">@{user.username}</p>
            </div>
          </div>

          <Rule />

          <div className="grid gap-1 font-mono text-[10px] uppercase tracking-[0.16em]">
            <p className="flex justify-between border-b border-line/40 py-1.5">
              <span className="text-dim">FILE</span>
              <span className="text-ash">{String(user.id).padStart(3, "0")}</span>
            </p>
            {!user.email?.endsWith("@hearth.local") && (
              <p className="flex justify-between border-b border-line/40 py-1.5">
                <span className="text-dim">SID</span>
                <span className="text-ash">{user.email}</span>
              </p>
            )}
          </div>

          <div>
            <Meta>STATEMENT</Meta>
            <Serif className="mt-1.5 block text-base italic leading-relaxed text-ivory/90">
              {user.bio ? user.bio : "No statement filed."}
            </Serif>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default UserProfileModal;
