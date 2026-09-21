"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// The Web Speech API's SpeechRecognition constructor isn't in lib.dom.d.ts
// yet and is vendor-prefixed on the browsers that do support it (Chrome/
// Edge desktop + Android; Safari/iOS doesn't implement it at all as of this
// writing) — minimal typing for just what's used below.
interface SpeechRecognitionResultLike {
  transcript: string;
}
interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function AskPamiForm({ userId }: { userId: string }) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSpeechSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  function toggleListening() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) setText(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

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
          className="flex-1"
        />
        {speechSupported && (
          <Button
            type="button"
            variant={listening ? "default" : "outline"}
            size="icon"
            aria-label={listening ? "Stop listening" : "Ask by voice"}
            onClick={toggleListening}
            className={listening ? "pami-gradient border-0 text-white" : undefined}
          >
            <MicIcon listening={listening} />
          </Button>
        )}
        <Button type="submit" disabled={pending || !text.trim()}>
          {pending ? "Sending…" : "Ask"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}

function MicIcon({ listening }: { listening: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {listening && (
        <circle cx="12" cy="12" r="10" className="animate-ping opacity-30" fill="currentColor" stroke="none" />
      )}
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 19v3" />
    </svg>
  );
}
