"use client";

import { useState } from "react";
import { Volume2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Switch } from "@/components/ui/switch";
import { IconBadge, ListRow } from "@/components/ui/list";

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
    <>
      <ListRow
        icon={<IconBadge icon={Volume2} className="bg-ios-pink" />}
        title={<label htmlFor="voice-responses">Speak Responses</label>}
        detail={
          <Switch
            id="voice-responses"
            checked={enabled}
            disabled={pending}
            onCheckedChange={handleChange}
          />
        }
      />
      {error && <ListRow title={<span className="text-[15px] text-destructive">{error}</span>} />}
    </>
  );
}
