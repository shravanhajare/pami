"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AskPamiForm({ userId }: { userId: string }) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setPending(true);
    setError(null);

    const supabase = createClient();
    // Delegated to the Mac's Claude Code CLI once the Mac picks this up on
    // its next heartbeat — see apps/mac/Sources/PamiMac/ClaudeCodeProvider.swift.
    const { error } = await supabase.from("tasks").insert({
      user_id: userId,
      source: "web",
      type: "ask",
      title: text.length > 60 ? `${text.slice(0, 57)}...` : text,
      prompt: text,
      status: "pending",
    });

    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    setText("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          placeholder="Ask PAMI anything…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" disabled={pending || !text.trim()}>
          {pending ? "Sending…" : "Ask"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
