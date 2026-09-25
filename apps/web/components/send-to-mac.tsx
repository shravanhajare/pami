"use client";

import { useState, useSyncExternalStore } from "react";
import { ClipboardPaste, Laptop } from "lucide-react";
import { useRunOnMac } from "@/components/live-activity";
import { SegmentedControl } from "@/components/ui/segmented-control";

type Mode = "clipboard" | "link";

const noopSubscribe = () => () => {};
const canReadClipboard = () => typeof navigator.clipboard?.readText === "function";

// Wraps a string for sh as one literal argument: close the quote, emit an
// escaped quote, reopen — the only character single quotes can't hold.
function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

// "apple.com/iphone" → https://apple.com/iphone; anything that isn't a
// plain web address is rejected rather than handed to `open`.
function toWebURL(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

// Continuity from the phone: hand text or a link to the Mac the way
// Universal Clipboard / Handoff would.
export function SendToMac() {
  const run = useRunOnMac();
  const [mode, setMode] = useState<Mode>("clipboard");
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [pending, setPending] = useState(false);
  const pasteSupported = useSyncExternalStore(noopSubscribe, canReadClipboard, () => false);

  const url = toWebURL(link);
  const ready = mode === "clipboard" ? text.trim().length > 0 : url !== null;

  async function paste() {
    try {
      const value = await navigator.clipboard.readText();
      if (mode === "clipboard") setText(value);
      else setLink(value.trim());
    } catch {
      // Permission refused (iOS shows its own "Paste" bubble) — nothing to do.
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setPending(true);
    const { error } =
      mode === "clipboard"
        ? await run({ type: "clipboard_set", title: "Copy to Mac clipboard", prompt: text }, { label: "Clipboard" })
        : await run(
            { type: "system_command", title: `Open ${url!.host} on Mac`, prompt: `open ${shellQuote(url!.href)}` },
            { label: `Opening ${url!.host}` },
          );
    setPending(false);
    if (!error) {
      if (mode === "clipboard") setText("");
      else setLink("");
    }
  }

  return (
    <div className="rounded-2xl bg-card p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-ios-blue text-white">
          <Laptop className="size-5" />
        </span>
        <div>
          <p className="text-[15px] font-semibold">Send to your Mac</p>
          <p className="text-[13px] text-muted-foreground">
            {mode === "clipboard" ? "Lands on the Mac’s clipboard, ready to paste" : "Opens in the Mac’s default browser"}
          </p>
        </div>
      </div>

      <SegmentedControl
        aria-label="What to send"
        value={mode}
        onChange={setMode}
        options={[
          { value: "clipboard", label: "Text" },
          { value: "link", label: "Link" },
        ]}
        className="mb-3"
      />

      <form onSubmit={submit} className="flex flex-col gap-2">
        {mode === "clipboard" ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Text for your Mac’s clipboard"
            rows={3}
            className="resize-none rounded-xl bg-card-2 px-3.5 py-2.5 text-[17px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
          />
        ) : (
          <input
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="apple.com"
            aria-invalid={link.trim() !== "" && url === null}
            className="h-11 rounded-xl bg-card-2 px-3.5 text-[17px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40 aria-invalid:ring-2 aria-invalid:ring-destructive/50"
          />
        )}
        <div className="flex gap-2">
          {pasteSupported && (
            <button
              type="button"
              onClick={paste}
              className="pressable flex h-11 items-center justify-center gap-1.5 rounded-xl bg-fill px-4 text-[17px] font-semibold"
            >
              <ClipboardPaste className="size-4.5" /> Paste
            </button>
          )}
          <button
            type="submit"
            disabled={pending || !ready}
            className="pressable h-11 flex-1 rounded-xl bg-primary text-[17px] font-semibold text-primary-foreground disabled:bg-fill disabled:text-muted-foreground"
          >
            {pending ? "Sending…" : mode === "clipboard" ? "Copy to Mac" : "Open on Mac"}
          </button>
        </div>
      </form>
    </div>
  );
}
