"use client";

import { useRef, useState } from "react";
import {
  Battery,
  Bell,
  CalendarDays,
  Camera,
  Clipboard,
  HardDrive,
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
import { useRunOnMac } from "@/components/live-activity";
import { SegmentedControl } from "@/components/ui/segmented-control";

type Action = {
  type: string;
  title: string;
  prompt?: string;
  icon: LucideIcon;
  color: string;
  copyable?: boolean;
};

// quick_command prompts are the same phrases the Mac's QuickCommands
// understands by voice, so buttons and speech share one vocabulary.
const SYSTEM: Action[] = [
  { type: "lock_screen", title: "Lock", icon: Lock, color: "bg-ios-indigo" },
  { type: "quick_command", title: "Display Off", prompt: "turn off the display", icon: MonitorOff, color: "bg-ios-blue" },
  { type: "quick_command", title: "Sleep", prompt: "sleep", icon: Power, color: "bg-ios-purple" },
  { type: "quick_command", title: "Screenshot", prompt: "take a screenshot", icon: Camera, color: "bg-ios-gray" },
  { type: "quick_command", title: "Appearance", prompt: "toggle dark mode", icon: Moon, color: "bg-ios-indigo" },
  { type: "battery_status", title: "Battery", icon: Battery, color: "bg-ios-green" },
  {
    // Free space on the startup volume, in one line ("212GB free of 494GB")
    // rather than df's full table.
    type: "system_command",
    title: "Storage",
    prompt: `df -H / | awk 'NR==2 {print $4 "B free of " $2 "B"}'`,
    icon: HardDrive,
    color: "bg-ios-teal",
  },
  { type: "clipboard_get", title: "Clipboard", icon: Clipboard, color: "bg-ios-orange", copyable: true },
];

export function QuickActions() {
  const run = useRunOnMac();

  return (
    <div className="flex flex-col gap-3">
      <MediaCard />

      <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-8">
        {SYSTEM.map((action) => (
          <button
            key={action.title}
            type="button"
            onClick={() =>
              run(
                { type: action.type, title: action.title, prompt: action.prompt },
                { copyable: action.copyable },
              )
            }
            className="pressable flex flex-col items-center gap-2 rounded-2xl bg-card px-1 pt-3.5 pb-3"
          >
            <span className={cn("flex size-10 items-center justify-center rounded-full text-white", action.color)}>
              <action.icon className="size-5" />
            </span>
            <span className="w-full truncate text-center text-[11px] font-medium text-foreground/90">
              {action.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// The Lock Screen "Now Playing" platter: transport controls plus the fat
// Control Center volume slider.
function MediaCard() {
  const run = useRunOnMac();
  const transport: { title: string; type: string; prompt: string; icon: LucideIcon; big?: boolean }[] = [
    { title: "Previous", type: "quick_command", prompt: "previous track", icon: SkipBack },
    { title: "Play", type: "music_control", prompt: "play", icon: Play, big: true },
    { title: "Pause", type: "music_control", prompt: "pause", icon: Pause, big: true },
    { title: "Next", type: "music_control", prompt: "next", icon: SkipForward },
  ];

  return (
    <div className="rounded-2xl bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-b from-[#fc5c7d] to-[#fa233b] text-white">
          <Music className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Music</p>
          <p className="text-[13px] text-muted-foreground">Controls whatever&rsquo;s playing on your Mac</p>
        </div>
        <button
          type="button"
          onClick={() =>
            run({ type: "music_control", title: "Now Playing", prompt: "now_playing" }, { copyable: true })
          }
          className="pressable shrink-0 rounded-full bg-fill px-3 py-1.5 text-[13px] font-semibold"
        >
          What&rsquo;s on?
        </button>
      </div>

      <div className="my-4 flex items-center justify-around">
        {transport.map((t) => (
          <button
            key={t.title}
            type="button"
            aria-label={t.title}
            onClick={() => run({ type: t.type, title: t.title, prompt: t.prompt })}
            className={cn(
              "pressable flex items-center justify-center rounded-full active:bg-fill",
              t.big ? "size-14" : "size-12",
            )}
          >
            <t.icon className={t.big ? "size-8" : "size-6"} fill="currentColor" strokeWidth={1.5} />
          </button>
        ))}
      </div>

      <VolumeSlider />
    </div>
  );
}

function VolumeSlider() {
  const run = useRunOnMac();
  const [value, setValue] = useState(50);
  const [touched, setTouched] = useState(false);
  const startValue = useRef(50);
  const trackRef = useRef<HTMLDivElement>(null);

  function valueAt(clientX: number) {
    const rect = trackRef.current!.getBoundingClientRect();
    return Math.round(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * 20) * 5;
  }

  function commit(next: number) {
    setTouched(true);
    run({ type: "volume_set", title: `Volume ${next}%`, prompt: String(next) }, { label: "Volume" });
  }

  const Icon = value === 0 ? VolumeX : value < 50 ? Volume1 : Volume2;

  return (
    <div className="flex flex-col gap-2.5">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Mac volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${value}%`}
        // pan-y: a vertical swipe that starts here still scrolls the page
        // (and cancels the drag below) instead of getting stuck.
        style={{ touchAction: "pan-y" }}
        className="relative h-12 cursor-pointer overflow-hidden rounded-[14px] bg-fill outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          startValue.current = value;
          setValue(valueAt(e.clientX));
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) setValue(valueAt(e.clientX));
        }}
        onPointerUp={(e) => {
          const next = valueAt(e.clientX);
          setValue(next);
          commit(next);
        }}
        onPointerCancel={() => setValue(startValue.current)}
        onKeyDown={(e) => {
          const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 5 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -5 : 0;
          if (!step) return;
          e.preventDefault();
          const next = Math.min(100, Math.max(0, value + step));
          setValue(next);
          commit(next);
        }}
      >
        <div
          className="absolute inset-y-0 left-0 bg-white transition-[width] duration-75"
          style={{ width: `${value}%` }}
        />
        <Icon
          className={cn(
            "pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2",
            value > 12 ? "text-black/55" : "text-muted-foreground",
          )}
        />
        <span
          className={cn(
            "pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[13px] font-semibold tabular-nums",
            value > 88 ? "text-black/55" : "text-muted-foreground",
          )}
        >
          {touched ? `${value}%` : "Drag to set"}
        </span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => run({ type: "quick_command", title: "Mute", prompt: "mute" })}
          className="pressable flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-fill text-[13px] font-semibold"
        >
          <VolumeX className="size-4" /> Mute
        </button>
        <button
          type="button"
          onClick={() => run({ type: "quick_command", title: "Unmute", prompt: "unmute" })}
          className="pressable flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-fill text-[13px] font-semibold"
        >
          <Volume2 className="size-4" /> Unmute
        </button>
      </div>
    </div>
  );
}

type AppTab = "reminder" | "note" | "calendar";

export function AppleApps() {
  const run = useRunOnMac();
  const [tab, setTab] = useState<AppTab>("reminder");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (tab !== "calendar" && !title.trim()) return;
    setPending(true);
    const { error } =
      tab === "calendar"
        ? await run({ type: "calendar_today", title: "What's on my calendar today?" }, { label: "Today" })
        : tab === "note"
          ? await run({ type: "create_note", title, prompt: body }, { label: "New Note" })
          : await run({ type: "create_reminder", title, prompt: title }, { label: "New Reminder" });
    setPending(false);
    if (!error) {
      setTitle("");
      setBody("");
    }
  }

  const icons: Record<AppTab, { icon: LucideIcon; color: string; name: string }> = {
    reminder: { icon: Bell, color: "bg-ios-blue", name: "Reminders" },
    note: { icon: StickyNote, color: "bg-ios-yellow text-black", name: "Notes" },
    calendar: { icon: CalendarDays, color: "bg-ios-red", name: "Calendar" },
  };
  const current = icons[tab];

  return (
    <div className="rounded-2xl bg-card p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-[10px] text-white", current.color)}>
          <current.icon className="size-5" />
        </span>
        <div>
          <p className="text-[15px] font-semibold">{current.name}</p>
          <p className="text-[13px] text-muted-foreground">Syncs to your Mac&rsquo;s Apple apps</p>
        </div>
      </div>

      <SegmentedControl
        aria-label="Apple app"
        value={tab}
        onChange={setTab}
        options={[
          { value: "reminder", label: "Reminder" },
          { value: "note", label: "Note" },
          { value: "calendar", label: "Today" },
        ]}
        className="mb-3"
      />

      <form onSubmit={submit} className="flex flex-col gap-2">
        {tab !== "calendar" ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={tab === "reminder" ? "Remind me to…" : "Title"}
            enterKeyHint={tab === "reminder" ? "done" : "next"}
            className="h-11 rounded-xl bg-card-2 px-3.5 text-[17px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
          />
        ) : (
          <p className="rounded-xl bg-card-2 px-3.5 py-3 text-[15px] text-muted-foreground">
            Reads today&rsquo;s events from Calendar on your Mac.
          </p>
        )}
        {tab === "note" && (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write something…"
            rows={3}
            className="resize-none rounded-xl bg-card-2 px-3.5 py-2.5 text-[17px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
          />
        )}
        <button
          type="submit"
          disabled={pending || (tab !== "calendar" && !title.trim())}
          className="pressable h-11 rounded-xl bg-primary text-[17px] font-semibold text-primary-foreground disabled:bg-fill disabled:text-muted-foreground"
        >
          {pending
            ? "Sending…"
            : tab === "calendar"
              ? "What’s on today?"
              : tab === "note"
                ? "Create Note"
                : "Add Reminder"}
        </button>
      </form>
    </div>
  );
}
