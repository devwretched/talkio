"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Avatar, Spinner, Modal, inputClass } from "@/components/ui";
import { Display, Eyebrow, Meta, Reveal, Rule, Serif, PrimaryButton } from "@/components/veil/typography";
import type { User } from "@/types";

/**
 * PERSONNEL — your own dossier. Members' public view has no backend for
 * rosters yet (no members API), so this page presents the signed-in member
 * only, with honest placeholders where data doesn't exist.
 * Profile previews of *other* members remain the dossier-styled modal.
 */

export default function PersonnelPage() {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [editOpen, setEditOpen] = useState(false);

  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const uploadAvatar = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("avatar", file);
      const res = await api.postForm<{ url: string }>("/api/upload/avatar", form);
      if (user) setUser({ ...user, avatar: res.url });
    } catch (err) {
      alert((err as { message?: string }).message || "Failed to upload avatar");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 md:px-10 md:py-14">
      <Reveal>
        <Eyebrow index="05">PERSONNEL — DOSSIER 001</Eyebrow>
        <Rule className="mt-3" />
      </Reveal>

      <div className="mt-10 grid gap-10 md:grid-cols-[auto_1fr] md:gap-14">
        {/* Identity mark */}
        <Reveal delay={0.06}>
          <div className="flex flex-row items-center gap-5 md:flex-col md:items-start">
            <button
              onClick={() => fileInput.current?.click()}
              className="group relative"
              aria-label="Change avatar"
              disabled={uploading}
            >
              {uploading ? (
                <span className="flex h-32 w-32 items-center justify-center"><Spinner /></span>
              ) : (
                <Avatar user={user} size={32} />
              )}
              <span className="absolute inset-0 hidden items-center justify-center bg-black/60 font-mono text-[9px] uppercase tracking-[0.2em] text-bone group-hover:flex">
                change
              </span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
            />
            <p className="hidden font-mono text-[9px] uppercase tracking-[0.18em] text-dim md:block">
              PORTRAIT · {user.avatar ? "ON FILE" : "NOT SET"}
            </p>
          </div>
        </Reveal>

        {/* Dossier body */}
        <Reveal delay={0.12}>
          <div>
            <h1 className="mt-2">
              <Display className="text-5xl text-bone md:text-7xl">{user.name || user.username}</Display>
            </h1>
            <button
              onClick={() => setEditOpen(true)}
              className="mt-2 font-mono text-sm tracking-[0.12em] text-oxide transition-colors hover:text-bone"
            >
              @{user.username}
            </button>

            <div className="mt-6 grid max-w-md gap-1 font-mono text-[10px] uppercase tracking-[0.16em]">
              <DossierRow k="FILE" v={`00${user.id}`.slice(-3)} />
              <DossierRow k="SID" v={user.email.endsWith("@hearth.local") ? "—" : user.email} />
              <DossierRow k="CLEARANCE" v="MEMBER" />
              <DossierRow k="SOCIAL LINKS" v="NOT WIRED TO BACKEND YET" muted />
            </div>

            <div className="mt-8 max-w-xl border border-line/60 bg-coal/40 p-5">
              <Meta>STATEMENT</Meta>
              <Serif className="mt-2 block text-lg italic leading-relaxed text-ivory/90">
                {user.bio ? user.bio : "No statement filed."}
              </Serif>
            </div>

            <div className="mt-8 flex gap-3">
              <PrimaryButton onClick={() => setEditOpen(true)}>Amend file</PrimaryButton>
            </div>
          </div>
        </Reveal>
      </div>

      <Reveal delay={0.18}>
        <Rule className="mt-14" />
        <p className="mt-4 font-mono text-[10px] leading-relaxed tracking-[0.08em] text-dim">
          MEMBER INDEX, ROLES AND PARTICIPATION RECORDS REQUIRE BACKEND SUPPORT — SEE KNOWN-ISSUES §6.3. PEER DOSSIERS
          OPEN FROM ANYWHERE A HANDLE IS SHOWN.
        </p>
      </Reveal>

      <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}

function DossierRow({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <p className="flex justify-between border-b border-line/40 py-1.5">
      <span className="text-dim">{k}</span>
      <span className={muted ? "text-dim" : "text-ash"}>{v}</span>
    </p>
  );
}

/** Inline modal keeps editing behaviour identical to the peek modal. */
function EditProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && user) {
      setUsername(user.username);
      setName(user.name || "");
      setBio(user.bio || "");
      setError(null);
    }
  }, [open, user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api.put<{ message: string; user: User }>("/api/me/profile", { username, name, bio });
      setUser(res.user);
      onClose();
    } catch (err) {
      setError((err as { message?: string }).message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Amend file">
      {user && (
        <form onSubmit={save} className="space-y-5">
          {error && (
            <p className="border-l-2 border-oxide bg-burgundy/20 py-2 pl-3 font-mono text-[11px] text-ivory">{error}</p>
          )}
          <div>
            <Meta className="mb-1 block">ALIAS</Meta>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required className={inputClass + " font-mono"} />
          </div>
          <div>
            <Meta className="mb-1 block">DISPLAY NAME</Meta>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <Meta className="mb-1 block">STATEMENT</Meta>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="A statement about you…" className={inputClass + " resize-none font-editorial text-base italic"} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="font-mono text-[11px] uppercase tracking-[0.2em] text-ash hover:text-bone">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-bone px-5 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink transition-colors hover:bg-white disabled:opacity-60"
            >
              {saving ? "saving…" : "Amend"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
