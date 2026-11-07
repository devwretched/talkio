"use client";

import { useState, useRef } from "react";
import { Spinner, inputClass, Modal } from "@/components/ui";
import { Meta } from "@/components/veil/typography";
import type { Thread } from "@/types";

export function ThreadCreateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (thread: Thread) => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle("");
    setContent("");
    setImages([]);
    setPreviews([]);
    setError(null);
  };

  const pickFiles = (files: FileList | null) => {
    setImages((prev) => [...prev, ...Array.from(files || [])].slice(0, 4));
    setPreviews((prev) => [...prev, ...Array.from(files || []).map(URL.createObjectURL)].slice(0, 4));
    // trim previews alongside images defensively
    setPreviews((p) => p.slice(0, 4));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const { api } = await import("@/lib/api");
      const uploads: { url: string }[] = [];
      for (const image of images) {
        const form = new FormData();
        form.append("image", image);
        uploads.push(await api.postForm<{ url: string }>("/api/upload/image", form));
      }
      const thread = await api.post<Thread>("/api/threads", {
        title: title.trim(),
        content,
        images: uploads.length ? uploads.map((u) => ({ url: u.url })) : [],
      });
      reset();
      onCreated(thread);
    } catch (err) {
      setError((err as { message?: string }).message || "Failed to create thread");
      setPending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Publish to research · 03">
      <form onSubmit={submit} className="space-y-5">
        {error && (
          <p className="border-l-2 border-oxide bg-burgundy/20 py-2 pl-3 font-mono text-[11px] text-ivory">{error}</p>
        )}
        <div>
          <Meta className="mb-1 block">TITLE · 3–200</Meta>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Entry title"
            required
            minLength={3}
            maxLength={200}
            className={inputClass}
          />
        </div>
        <div>
          <Meta className="mb-1 block">LEAD CONTENT · OPTIONAL</Meta>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write the opening…"
            rows={4}
            maxLength={10000}
            className={inputClass + " resize-none font-editorial text-base italic"}
          />
        </div>
        <div>
          <Meta className="mb-2 block">EXHIBITS · UP TO 4 IMAGES</Meta>
          <div className="flex flex-wrap gap-2">
            {previews.map((url, i) => (
              <div key={i} className="group relative">
                <img src={url} alt="" className="h-16 w-16 border border-line object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setImages((prev) => prev.filter((_, j) => j !== i));
                    setPreviews((prev) => prev.filter((_, j) => j !== i));
                  }}
                  className="absolute -right-1 -top-1 border border-line bg-ink font-mono text-[9px] text-oxide hover:text-bone"
                  aria-label="Remove image"
                >
                  ✕
                </button>
              </div>
            ))}
            {images.length < 4 && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex h-16 w-16 items-center justify-center border border-dashed border-line font-mono text-lg text-dim transition-colors hover:border-oxide hover:text-bone"
                aria-label="Add image"
              >
                ＋
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            className="hidden"
            onChange={(e) => pickFiles(e.target.files)}
          />
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="font-mono text-[11px] uppercase tracking-[0.2em] text-ash hover:text-bone">
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-2 bg-bone px-5 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink transition-colors hover:bg-white disabled:opacity-60"
          >
            {pending && <Spinner className="h-3 w-3" />}
            Publish
          </button>
        </div>
      </form>
    </Modal>
  );
}
