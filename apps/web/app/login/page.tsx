"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div
      className="flex flex-1 items-center justify-center px-5 py-16"
      style={{ paddingTop: "max(4rem, env(safe-area-inset-top))" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-9 flex flex-col items-center gap-4 text-center">
          <div className="pami-gradient flex size-20 items-center justify-center rounded-[22px] shadow-xl shadow-black/50">
            <span className="text-[34px] font-bold text-black">P</span>
          </div>
          <div>
            <h1 className="text-[28px] leading-tight font-bold tracking-tight">Sign in to PAMI</h1>
            <p className="mt-1 text-[15px] text-muted-foreground">Your personal AI agent, on your Mac.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* One grouped field, as in Apple's own sign-in sheets. */}
          <div className="overflow-hidden rounded-xl bg-card">
            <label htmlFor="email" className="sr-only">
              Email
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              enterKeyHint="next"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 w-full bg-transparent px-4 text-[17px] outline-none placeholder:text-muted-foreground"
            />
            <div className="ml-4 h-px bg-border" />
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              enterKeyHint="go"
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 w-full bg-transparent px-4 text-[17px] outline-none placeholder:text-muted-foreground"
            />
          </div>
          {error && <p className="px-4 text-center text-[15px] text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="pressable h-12 w-full rounded-xl bg-primary text-[17px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {pending ? "Signing In…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
