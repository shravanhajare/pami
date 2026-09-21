"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useVoiceSettings } from "@/hooks/use-voice-settings";

// The website's counterpart to the Mac's TextToSpeech.swift: reads new
// "ask" task completions aloud with the browser's own speech synthesis
// (works on iOS Safari, unlike SpeechRecognition — see AskPamiForm's mic
// button comment) when Settings > Speak responses aloud is on. Renders
// nothing; it's a side-effect-only listener mounted once on the dashboard.
export function VoiceResponseSpeaker({
  userId,
  initialEnabled,
  knownTaskIds,
}: {
  userId: string;
  initialEnabled: boolean;
  knownTaskIds: string[];
}) {
  const enabled = useVoiceSettings(userId, initialEnabled);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Only speak completions that happen *while this page is open* — tasks
  // already completed before mount (passed in via knownTaskIds) are past
  // history, not something to read aloud on every page load.
  const spokenRef = useRef<Set<string>>(new Set(knownTaskIds));

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const supabase = createClient();
    const channel = supabase
      .channel("voice-response-speaker")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            type: string;
            source: string;
            status: string;
            result: string | null;
          };
          if (spokenRef.current.has(row.id)) return;
          if (row.type !== "ask" || row.status !== "completed" || !row.result) return;
          // Only what was asked from a browser — a voice request already
          // spoken locally by the Mac (source "mac"/"voice") shouldn't
          // also come out of this tab's speakers.
          if (row.source !== "web" && row.source !== "mobile") return;

          spokenRef.current.add(row.id);
          if (!enabledRef.current) return;

          const utterance = new SpeechSynthesisUtterance(row.result);
          window.speechSynthesis.speak(utterance);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return null;
}
