"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Mic, Square, Terminal } from "lucide-react";
import { cn } from "cn";
import { createClient } from "@/lib/supabase/client";

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

// "$ brew upgrade" runs as a raw shell command; anything else is a
// natural-language request for the Mac's agent.
export function toTaskFields(text: string) {
  const trimmed = text.trim();
  const isCommand = trimmed.startsWith("$");
  const body = isCommand ? trimmed.slice(1).trim() : trimmed;
  return {
    type: isCommand ? "system_command" : "ask",
    title: body.length > 60 ? `${body.slice(0, 57)}...` : body,
    prompt: body,
  };
}

export async function sendToPami(userId: string, text: string) {
  const supabase = createClient();
  return supabase.from("tasks").insert({
    user_id: userId,
    source: "web",
    status: "pending",
    ...toTaskFields(text),
  });
}

export function AskPamiForm({
  userId,
  initialText = "",
  autoFocus = false,
  onSent,
}: {
  userId: string;
  initialText?: string;
  autoFocus?: boolean;
  onSent?: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSpeechSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  // Grow with the content up to ~6 lines, then scroll inside.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

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

  async function submit() {
    if (!text.trim() || pending) return;
    setPending(true);
    setError(null);
    const { error } = await sendToPami(userId, text);
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    setText("");
    onSent?.();
  }

  const isCommand = text.trim().startsWith("$");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-1.5"
    >
      <div
        className={cn(
          "pami-glass flex items-end gap-2 rounded-2xl p-2 shadow-lg shadow-black/20 transition-colors focus-within:border-primary/40",
          isCommand && "focus-within:border-emerald-400/40",
        )}
      >
        {isCommand && (
          <span className="mb-1.5 ml-1 flex shrink-0 items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-medium text-emerald-300">
            <Terminal className="size-3" />
            Shell
          </span>
        )}
        <textarea
          ref={textareaRef}
          rows={1}
          autoFocus={autoFocus}
          value={text}
          placeholder="Tell PAMI what to do on your Mac…"
          aria-label="Message PAMI"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          className={cn(
            "min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-5 outline-none placeholder:text-muted-foreground",
            isCommand && "font-mono text-sm",
          )}
        />
        {speechSupported && (
          <button
            type="button"
            aria-label={listening ? "Stop listening" : "Speak your request"}
            onClick={toggleListening}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              listening && "pami-gradient text-primary-foreground hover:text-primary-foreground",
            )}
          >
            {listening ? <Square className="size-3.5 fill-current" /> : <Mic className="size-4.5" />}
          </button>
        )}
        <button
          type="submit"
          aria-label="Send"
          disabled={pending || !text.trim()}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-30"
        >
          <ArrowUp className="size-4.5" strokeWidth={2.5} />
        </button>
      </div>
      <p className="px-3 text-[11px] text-muted-foreground">
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : (
          <>
            <kbd className="font-sans">Enter</kbd> to send · start with{" "}
            <code className="rounded bg-muted px-1">$</code> to run a shell command
          </>
        )}
      </p>
    </form>
  );
}
