"use client";

import { useState } from "react";
import {
  Battery,
  Bell,
  CalendarDays,
  Camera,
  Check,
  Clipboard,
  Lock,
  MonitorOff,
  Moon,
  Music,
  Pause,
  Play,
  Power,
  SkipBack,
  SkipForward,
  StickyNote,
  Volume1,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { createClient } from "@/lib/supabase/client";

async function insertTask(
  userId: string,
  fields: { type: string; title: string; prompt?: string },
) {
  const supabase = createClient();
  return supabase.from("tasks").insert({
    user_id: userId,
    source: "web",
    status: "pending",
    ...fields,
  });
}

type Action = { type: string; title: string; prompt?: string; icon: LucideIcon };

// quick_command prompts are the same phrases the Mac's QuickCommands
// understands by voice, so buttons and speech share one vocabulary.
const GROUPS: { label: string; actions: Action[] }[] = [
  {
    label: "Media",
    actions: [
      { type: "music_control", title: "Play", prompt: "play", icon: Play },
      { type: "music_control", title: "Pause", prompt: "pause", icon: Pause },
      { type: "quick_command", title: "Previous", prompt: "previous track", icon: SkipBack },
      { type: "music_control", title: "Next", prompt: "next", icon: SkipForward },
      { type: "music_control", title: "Now playing", prompt: "now_playing", icon: Music },
      { type: "quick_command", title: "Volume down", prompt: "volume down", icon: Volume1 },
      { type: "quick_command", title: "Volume up", prompt: "volume up", icon: Volume2 },
      { type: "quick_command", title: "Mute", prompt: "mute", icon: VolumeX },
    ],
  },
  {
    label: "System",
    actions: [
      { type: "lock_screen", title: "Lock", icon: Lock },
      { type: "quick_command", title: "Display off", prompt: "turn off the display", icon: MonitorOff },
      { type: "quick_command", title: "Sleep", prompt: "sleep", icon: Power },
      { type: "quick_command", title: "Screenshot", prompt: "take a screenshot", icon: Camera },
      { type: "quick_command", title: "Dark mode", prompt: "toggle dark mode", icon: Moon },
      { type: "battery_status", title: "Battery", icon: Battery },
      { type: "clipboard_get", title: "Clipboard", icon: Clipboard },
    ],
  },
];

export function QuickActions({ userId }: { userId: string }) {
  const [sent, setSent] = useState<string | null>(null);

  async function run(action: Action) {
    setSent(action.title);
    await insertTask(userId, { type: action.type, title: action.title, prompt: action.prompt });
    setTimeout(() => setSent((current) => (current === action.title ? null : current)), 1200);
  }

  return (
    <div className="flex flex-col gap-4">
      {GROUPS.map((group) => (
        <section key={group.label} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">{group.label}</h2>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {group.actions.map((action) => {
              const Icon = sent === action.title ? Check : action.icon;
              return (
                <button
                  key={action.title}
                  onClick={() => run(action)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border bg-card/60 px-1 py-3 text-[11px] font-medium text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground active:scale-95",
                    sent === action.title && "border-primary/50 text-primary",
                  )}
                >
                  <Icon className="size-5" />
                  <span className="truncate">{action.title}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <AppleApps userId={userId} />
    </div>
  );
}

type AppTab = "calendar" | "note" | "reminder";

function AppleApps({ userId }: { userId: string }) {
  const [tab, setTab] = useState<AppTab>("reminder");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    if (tab === "calendar") {
      await insertTask(userId, { type: "calendar_today", title: "What's on my calendar today?" });
      setDone("Asked your Mac — the answer will appear in Tasks.");
    } else if (tab === "note") {
      if (!title.trim()) return setPending(false);
      await insertTask(userId, { type: "create_note", title, prompt: body });
      setDone(`Note "${title}" sent to your Mac.`);
    } else {
      if (!title.trim()) return setPending(false);
      await insertTask(userId, { type: "create_reminder", title, prompt: title });
      setDone(`Reminder "${title}" sent to your Mac.`);
    }
    setPending(false);
    setTitle("");
    setBody("");
  }

  const tabs: { id: AppTab; label: string; icon: LucideIcon }[] = [
    { id: "reminder", label: "Reminder", icon: Bell },
    { id: "note", label: "Note", icon: StickyNote },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
  ];

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">Apple apps</h2>
      <div className="rounded-xl border bg-card/60 p-3">
        <div className="mb-3 flex gap-1 rounded-lg bg-muted p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setDone(null);
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium text-muted-foreground transition-colors",
                tab === t.id && "bg-background text-foreground shadow-sm",
              )}
            >
              <t.icon className="size-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-2">
          {tab !== "calendar" && (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tab === "reminder" ? "Remind me to…" : "Note title"}
              className="h-9 rounded-lg border bg-background/50 px-3 text-sm outline-none focus:border-primary/50"
            />
          )}
          {tab === "note" && (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write something…"
              rows={3}
              className="resize-none rounded-lg border bg-background/50 px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
          )}
          <button
            type="submit"
            disabled={pending || (tab !== "calendar" && !title.trim())}
            className="h-9 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending
              ? "Sending…"
              : tab === "calendar"
                ? "What's on today?"
                : tab === "note"
                  ? "Create note"
                  : "Add reminder"}
          </button>
          {done && <p className="text-xs text-muted-foreground">{done}</p>}
        </form>
      </div>
    </section>
  );
}
