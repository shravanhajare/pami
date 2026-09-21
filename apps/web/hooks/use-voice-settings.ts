"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Live-updates if the toggle is flipped from Settings in another tab/device
// — see supabase/migrations/0004_voice_settings.sql for why profiles is in
// the realtime publication.
export function useVoiceSettings(userId: string, initialEnabled: boolean) {
  const [enabled, setEnabled] = useState(initialEnabled);

  useEffect(() => {
    setEnabled(initialEnabled);
  }, [initialEnabled]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("voice-settings-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { voice_responses_enabled?: boolean };
          if (typeof row.voice_responses_enabled === "boolean") {
            setEnabled(row.voice_responses_enabled);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return enabled;
}
