"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/time";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/ui";
import { UserProfileModal } from "@/components/profile-settings";
import { useChatWebSocket } from "@/lib/ws";
import { Eyebrow, Meta, Reveal, Rule } from "@/components/veil/typography";
import type { ChatMessage, Chatroom, User } from "@/types";
import { cn } from "@/lib/utils";

/**
 * FREQUENCY — underground IRC energy on editorial surfaces.
 * All behaviour preserved: rooms, presence counts, WS live messages,
 * typing, history, connection state, single-pane mobile navigation.
 */

export default function ChatPage() {
  const params = useParams<{ id?: string }>();
  const roomId = params?.id ? Number(params.id) : undefined;
  return <ChatView roomId={roomId} />;
}

export function ChatView({ roomId }: { roomId?: number }) {
  const user = useAuth((s) => s.user);
  const [rooms, setRooms] = useState<Chatroom[] | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [profileUser, setProfileUser] = useState<User | null>(null);

  const loadRooms = async () => {
    try {
      setRooms(await api.get<Chatroom[]>("/api/chatrooms"));
    } catch {
      setRooms([]);
    }
  };

  useEffect(() => {
    loadRooms();
  }, [useAuth.getState().token]); // eslint-disable-line react-hooks/exhaustive-deps

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.post<Chatroom>("/api/chatrooms", { name: name.trim() });
      setName("");
      await loadRooms();
    } catch (err) {
      alert((err as { message?: string }).message || "Failed to open frequency");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="md:flex md:min-h-[calc(100vh-3rem)]">
      {/* ── Room index ── */}
      <aside
        className={
          "flex w-full flex-col border-b border-line/60 bg-coal/50 md:min-h-[calc(100vh-3rem)] md:w-72 md:border-b-0 md:border-r " +
          (roomId ? "hidden md:flex" : "flex")
        }
      >
        <div className="px-5 pt-8 md:pt-12">
          <Eyebrow index="04">FREQUENCY — LIVE</Eyebrow>
          <Rule className="mt-3" />
        </div>
        <form onSubmit={createRoom} className="mt-4 flex gap-2 px-5 pb-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="open a frequency…"
            aria-label="New room name"
            className="input-veil font-mono text-xs"
          />
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="shrink-0 border border-line px-3 font-mono text-xs text-oxide transition-colors hover:border-oxide hover:text-bone disabled:opacity-40"
          >
            ⇢
          </button>
        </form>

        <nav className="flex-1 overflow-y-auto pb-6">
          {rooms === null ? (
            <div className="flex justify-center pt-10"><Spinner /></div>
          ) : rooms.length === 0 ? (
            <p className="px-5 pt-6 font-editorial text-base italic text-ash">No frequencies open. Start one above.</p>
          ) : (
            rooms.map((room) => {
              const active = roomId === room.id;
              return (
                <Link
                  key={room.id}
                  href={room.id ? `/app/frequency/${room.id}` : "/app/frequency"}
                  className={cn(
                    "group flex items-center gap-3 border-b border-line/30 px-5 py-3 transition-colors",
                    active ? "bg-white/[0.04]" : "row-focus",
                  )}
                >
                  <span
                    className={
                      active
                        ? "h-px w-3 bg-oxide"
                        : (room.active_users ?? 0) > 0
                          ? "h-1 w-1 bg-oxide"
                          : "h-1 w-1 bg-line"
                    }
                  />
                  <span className="truncate font-mono text-sm text-ivory group-hover:text-bone">{room.name}</span>
                  {(room.active_users ?? 0) > 0 && (
                    <span className="ml-auto font-mono text-[10px] tracking-[0.14em] text-oxide">{room.active_users}</span>
                  )}
                </Link>
              );
            })
          )}
        </nav>
      </aside>

      {/* ── Conversation ── */}
      <div className="min-w-0 flex-1">
        {roomId ? (
          <Room roomId={roomId} me={user} onProfile={setProfileUser} rooms={rooms} />
        ) : (
          <div className="hidden h-full flex-col items-center justify-center gap-4 px-6 md:flex md:min-h-[calc(100vh-3rem)]">
            <Meta>Select a frequency from the index.</Meta>
            <Serif className="text-xl italic text-ash">Silence is also a frequency.</Serif>
          </div>
        )}
      </div>

      <UserProfileModal user={profileUser} open={!!profileUser} onClose={() => setProfileUser(null)} />
    </div>
  );
}

function Spinner() {
  return <div className="h-5 w-5 animate-spin border border-line border-t-oxide" aria-label="Loading" />;
}

function Room({
  roomId,
  me,
  onProfile,
  rooms,
}: {
  roomId: number;
  me: User | null;
  onProfile: (u: User) => void;
  rooms: Chatroom[] | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingCooldown = useRef(0);
  const roomName = rooms?.find((r) => r.id === roomId)?.name ?? `room-${roomId}`;

  const onLive = (msg: ChatMessage) =>
    setMessages((prev) => (prev?.some((m) => m.id === msg.id) ? prev : [...(prev ?? []), msg]));

  const { isConnected, sendMessage, sendTyping, typingUsers } = useChatWebSocket(roomId, onLive);

  useEffect(() => {
    setMessages(null);
    (async () => {
      try {
        const history = await api.get<ChatMessage[]>(`/api/chatrooms/${roomId}/history`);
        setMessages([...history].reverse());
      } catch {
        setMessages([]);
      }
    })();
  }, [roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const content = draft.trim();
    if (!content || !isConnected) return;
    sendMessage(content);
    setDraft("");
  };

  const handleTyping = () => {
    const now = Date.now();
    if (now - typingCooldown.current > 1000) {
      typingCooldown.current = now;
      sendTyping();
    }
  };

  return (
    <div className="flex min-h-screen md:min-h-[calc(100vh-3rem)] md:pl-0">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Room header */}
        <header className="sticky top-12 z-10 flex h-12 items-center justify-between border-b border-line/60 bg-ink/70 px-5 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <Link href="/app/frequency" className="font-mono text-xs text-ash hover:text-bone md:hidden" aria-label="Back to index">
              ←
            </Link>
            <h2 className="font-mono text-sm font-semibold tracking-[0.1em] text-bone"># {roomName}</h2>
          </div>
          <span className="flex items-center gap-2">
            <span className={cn("h-1.5 w-1.5", isConnected ? "bg-oxide" : "bg-dim animate-pulse")} />
            <Meta>{isConnected ? "LIVE" : "CONNECTING…"}</Meta>
          </span>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-6 text-sm">
          {messages === null ? (
            <div className="flex justify-center pt-10"><Spinner /></div>
          ) : messages.length === 0 ? (
            <p className="pt-10 text-center font-editorial text-lg italic text-ash">
              Nothing broadcast yet. Open the channel.
            </p>
          ) : (
            messages.map((msg, i) => {
              const prev = messages[i - 1];
              const grouped =
                prev?.user_id === msg.user_id &&
                new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000;
              return (
                <div key={msg.id} className="group px-5">
                  {grouped ? (
                    <div className="ml-9 border-l border-line/0 py-0.5 pl-[1.35rem] opacity-0 transition-opacity group-hover:opacity-100">
                      <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ivory/90">{msg.content}</p>
                    </div>
                  ) : (
                    <Reveal>
                      <div className="flex gap-3 pt-3">
                        <button onClick={() => onProfile(msg.user)} aria-label="View member" className="mt-0.5 shrink-0">
                          <Avatar user={msg.user} size={6} />
                        </button>
                        <div className="min-w-0 flex-1 pb-1">
                          <div className="flex items-baseline gap-3">
                            <button
                              onClick={() => onProfile(msg.user)}
                              className="font-mono text-[11px] font-semibold tracking-[0.08em] text-bone/90 hover:text-oxide"
                            >
                              @{msg.user?.username}
                            </button>
                            <Meta>{timeAgo(msg.created_at)}</Meta>
                          </div>
                          <p className="mt-0.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ivory/90">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    </Reveal>
                  )}
                </div>
              );
            })
          )}
          {typingUsers.length > 0 && (
            <p className="px-5 pt-4 font-mono text-[10px] italic tracking-[0.1em] text-ash">
              » {typingUsers.slice(0, 3).join(", ")} transmitting…
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="sticky bottom-0 border-t border-line/60 bg-coal/70 px-5 py-3 backdrop-blur-sm"
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-oxide">{">"}</span>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
                handleTyping();
              }}
              placeholder={isConnected ? `transmit to #${roomName}` : "connecting…"}
              className="w-full bg-transparent font-mono text-sm text-bone placeholder:text-dim focus:outline-none"
              aria-label={`Message #${roomName}`}
            />
            <button
              type="submit"
              disabled={!isConnected || !draft.trim()}
              className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash transition-colors hover:text-bone disabled:opacity-40"
              aria-label="Send"
            >
              send ⇥
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Serif helper (local alias to keep imports tidy in Room)
function Serif({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-editorial ${className ?? ""}`}>{children}</span>;
}
