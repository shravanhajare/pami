"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function ActivatePamiButton({ userId }: { userId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleActivate() {
    setPending(true);
    setError(null);
    const supabase = createClient();
    // Same insert path a future mobile/voice client would use — no
    // special-cased "activate" endpoint, per the unified activation model.
    const { error } = await supabase.from("tasks").insert({
      user_id: userId,
      source: "web",
      type: "manual_activation",
      title: "Activate PAMI",
      status: "pending",
    });
    setPending(false);
    if (error) setError(error.message);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        size="lg"
        onClick={handleActivate}
        disabled={pending}
        className="pami-gradient w-full border-0 text-white shadow-lg shadow-purple-500/20 transition-transform hover:scale-[1.01] hover:opacity-95 active:scale-[0.99]"
      >
        {pending ? "Activating…" : "Activate PAMI"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
