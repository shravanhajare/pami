"use client";

import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { haptic } from "@/lib/haptics";
import { ListSection } from "@/components/ui/list";

export function PairDeviceForm() {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);

    const supabase = createClient();
    const { error } = await supabase.functions.invoke("device-pair-confirm", {
      body: { pairing_code: code.trim() },
    });

    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    haptic();
    setSuccess(true);
    setCode("");
  }

  return (
    <ListSection
      title="Pair a New Mac"
      footer="Open the PAMI menu bar app on your Mac — it shows a code like ABC-123."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
        <label htmlFor="pairing-code" className="sr-only">
          Pairing code from your Mac
        </label>
        <input
          id="pairing-code"
          placeholder="ABC-123"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          required
          autoComplete="one-time-code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          className="h-14 w-full rounded-xl bg-card-2 text-center font-mono text-[28px] font-semibold tracking-[0.2em] outline-none placeholder:text-label-3 focus:ring-2 focus:ring-ring/40"
        />
        <button
          type="submit"
          disabled={pending || !code}
          className="pressable h-12 rounded-xl bg-primary text-[17px] font-semibold text-primary-foreground disabled:bg-fill disabled:text-muted-foreground"
        >
          {pending ? "Pairing…" : "Pair Mac"}
        </button>
        {error && <p className="text-center text-[15px] text-destructive">{error}</p>}
        {success && (
          <p className="flex items-center justify-center gap-1.5 text-[15px] font-medium text-ios-green">
            <CircleCheck className="size-4.5" /> Mac paired
          </p>
        )}
      </form>
    </ListSection>
  );
}
