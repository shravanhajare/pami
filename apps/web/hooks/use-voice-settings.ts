"use client";

import { useEffect, useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Live-updates if the toggle is flipped from Settings in another tab/device
// — see supabase/migrations/0004_voice_settings.sql for why profiles is in
// the realtime publication.
export function useVoiceSettings(userId: string, initialEnabled: boolean) {
  // Unique per mounted hook: realtime-js hands back the *same* channel for
  // a repeated topic, so two components on one page would otherwise share
  // (and tear down) each other's subscription.
  const channelId = useId();
  const [enabled, setEnabled] = useState(initialEnabled);

  // Re-seed when the server sends fresh rows (navigation, router.refresh()
  // on resume) — adjusted during render rather than in an effect, so there's
  // no extra render showing the stale list first.
  const [seed, setSeed] = useState(initialEnabled);
  if (initialEnabled !== seed) {
    setSeed(initialEnabled);
    setEnabled(initialEnabled);
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`voice-settings-changes-${channelId}`)
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
  }, [userId, channelId]);

  return enabled;
}
