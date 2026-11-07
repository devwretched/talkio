"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Display, Meta, PrimaryButton } from "@/components/veil/typography";
import { cn } from "@/lib/utils";

/**
 * The front door of VEIL. There is no public homepage: visitors meet a
 * split composition — the identity on the left, a discharge point on the
 * right. Registration requires an invite code. Members land directly in
 * COMMAND.
 */

type Mode = "checking" | "login" | "signup";

export default function Gate() {
  const router = useRouter();
  const { token, login } = useAuth();
  const [mode, setMode] = useState<Mode>("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (token) return router.replace("/app/command");
      try {
        const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
        if (res.ok) {
          const data = (await res.json()) as { token: string; user: import("@/types").User };
          if (!cancelled) {
            login(data.user, data.token);
            router.replace("/app/command");
          }
          return;
        }
      } catch {
        /* fall through */
      }
      if (!cancelled) setMode("login");
    })();
    return () => {
      cancelled = true;
    };
  }, [token, login, router]);

  if (mode === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <motion.span
          className="h-6 w-24 border-b border-oxide"
          animate={{ scaleX: [0.2, 1, 0.2] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen lg:grid lg:grid-cols-[1.15fr_0.85fr]">
      {/* ── Left: identity statement ── */}
      <section className="relative flex min-h-[46vh] flex-col justify-between p-8 md:p-12 lg:min-h-screen lg:p-16">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
          <Meta>R0 · PRIVATE COLLECTIVE</Meta>
          <h1 className="mt-6">
            <Display className="block text-[22vw] text-bone md:text-[13rem] lg:text-[11vw] xl:text-[12rem]">VEIL</Display>
          </h1>
          <p className="mt-4 max-w-md font-editorial text-xl italic text-ivory md:text-2xl">
            Not everyone gets access.
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-ash">
            An independent collective for those who build, investigate and challenge the known.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="mt-14 grid max-w-md grid-cols-1 gap-2 border-t border-line/70 pt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-dim sm:grid-cols-3"
        >
          <span>ACCESS · INVITATION</span>
          <span>SESSIONS · JWT</span>
          <span className="text-ash">NODE · 5070</span>
        </motion.div>
      </section>

      {/* ── Right: the discharge point ── */}
      <section className="flex items-center justify-center border-t border-line/60 bg-coal/40 p-6 backdrop-blur-sm lg:min-h-screen lg:border-l lg:border-t-0 lg:p-16">
        <div className="w-full max-w-sm">
          <ModeSwitch mode={mode} onChange={setMode} />
          {mode === "login" ? (
            <LoginForm
              onSuccess={(user, tok) => {
                login(user, tok);
                router.replace("/app/command");
              }}
              goSignup={() => setMode("signup")}
            />
          ) : (
            <SignupForm
              onSuccess={(user, tok) => {
                login(user, tok);
                router.replace("/app/command");
              }}
              goLogin={() => setMode("login")}
            />
          )}
        </div>
      </section>
    </main>
  );
}

function ModeSwitch({ mode, onChange }: { mode: Exclude<Mode, "checking">; onChange: (m: Exclude<Mode, "checking">) => void }) {
  const tabs = [
    { id: "login" as const, label: "Sign in" },
    { id: "signup" as const, label: "Register" },
  ];
  return (
    <div className="mb-10 flex gap-8 border-b border-line/70">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "relative pb-3 font-mono text-[11px] uppercase tracking-[0.22em] transition-colors",
            mode === t.id ? "text-bone" : "text-dim hover:text-ash",
          )}
        >
          {t.label}
          {mode === t.id && (
            <motion.span
              layoutId="gate-tab"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="absolute inset-x-0 -bottom-px h-px bg-oxide"
            />
          )}
        </button>
      ))}
    </div>
  );
}

type User = import("@/types").User;

function ErrorLine({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="border-l-2 border-oxide bg-burgundy/20 py-2 pl-3 pr-2 font-mono text-[11px] leading-relaxed text-ivory">
      {children}
    </p>
  );
}

function LoginForm({ onSuccess, goSignup }: { onSuccess: (user: User, token: string) => void; goSignup: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await api.post<{ token: string; user: User }>(
        "/api/auth/login",
        { username: username.trim(), password },
        false,
      );
      onSuccess(res.user, res.token);
    } catch (err) {
      setError((err as { message?: string }).message || "Login failed");
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <ErrorLine>{error}</ErrorLine>
      <div>
        <label htmlFor="gate-user" className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
          Alias
        </label>
        <input
          id="gate-user"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
          className="input-veil font-mono"
          placeholder="your alias"
        />
      </div>
      <div>
        <label htmlFor="gate-pass" className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
          Passphrase
        </label>
        <input
          id="gate-pass"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="input-veil font-mono"
          placeholder="········"
        />
      </div>
      <PrimaryButton type="submit" disabled={pending} className="w-full">
        {pending ? "verifying…" : "Cross the veil"}
      </PrimaryButton>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
        No credentials?{" "}
        <button type="button" onClick={goSignup} className="text-ash underline-offset-4 hover:text-bone hover:underline">
          Register with an invite
        </button>
      </p>
    </form>
  );
}

function SignupForm({ onSuccess, goLogin }: { onSuccess: (user: User, token: string) => void; goLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await api.post<{ token: string; user: User }>(
        "/api/auth/register",
        { username: username.trim(), password, invite_code: inviteCode.toUpperCase().trim() },
        false,
      );
      onSuccess(res.user, res.token);
    } catch (err) {
      setError((err as { message?: string }).message || "Registration failed");
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <ErrorLine>{error}</ErrorLine>
      <div>
        <label htmlFor="gate-user" className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
          Alias · 3–30, letters and numbers
        </label>
        <input
          id="gate-user"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
          className="input-veil font-mono"
          placeholder="choose an alias"
        />
      </div>
      <div>
        <label htmlFor="gate-pass" className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
          Passphrase · minimum 8
        </label>
        <input
          id="gate-pass"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          className="input-veil font-mono"
          placeholder="········"
        />
      </div>
      <div>
        <label htmlFor="gate-invite" className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
          Invite code · issued by an operator
        </label>
        <input
          id="gate-invite"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          required
          className="input-veil text-center font-mono text-lg font-semibold tracking-[0.3em] text-bone placeholder:text-dim"
          placeholder="——————"
        />
      </div>
      <PrimaryButton type="submit" disabled={pending} className="w-full">
        {pending ? "creating identity…" : "Request entry"}
      </PrimaryButton>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
        Already inside?{" "}
        <button type="button" onClick={goLogin} className="text-ash underline-offset-4 hover:text-bone hover:underline">
          Sign in
        </button>
      </p>
    </form>
  );
}
