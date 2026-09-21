"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function VoiceSettingsForm({
  userId,
  initialEnabled,
}: {
  userId: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: boolean) {
    setEnabled(next);
    setPending(true);
    setError(null);

    const supabase = createClient();
    // The single source of truth for "should PAMI speak" everywhere — the
    // Mac companion picks this up on its next heartbeat
    // (see apps/mac/Sources/PamiMac/AppState.swift), and this website reads
    // it back to decide whether to speak "ask" responses out loud itself.
    const { error } = await supabase
      .from("profiles")
      .update({ voice_responses_enabled: next })
      .eq("id", userId);

    setPending(false);
    if (error) {
      setEnabled(!next);
      setError(error.message);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="voice-responses">Speak responses aloud</Label>
          <p className="text-sm text-muted-foreground">
            Applies everywhere — your paired Mac and this website.
          </p>
        </div>
        <Switch
          id="voice-responses"
          checked={enabled}
          disabled={pending}
          onCheckedChange={handleChange}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
