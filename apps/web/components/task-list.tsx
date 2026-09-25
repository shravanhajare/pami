"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Check, CircleAlert, Copy, RotateCcw, Share, Sparkles, Square, Volume2, Zap } from "lucide-react";
import { cn } from "cn";
import { useTasksRealtime } from "@/hooks/use-tasks-realtime";
import { useHydrated } from "@/hooks/use-hydrated";
import type { Database, TaskStatus } from "@/lib/supabase/database.types";
import { formatTaskType, formatRelativeTime } from "@/lib/format-task";
import { haptic } from "@/lib/haptics";
import { SUGGESTIONS } from "@/lib/suggestions";
import { AskPamiForm, sendToPami } from "@/components/ask-pami-form";
import { PageHeader } from "@/components/page-header";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

const ACTIVE_STATUSES = new Set<TaskStatus>([
  "pending",
  "acknowledged",
  "in_progress",
  "waiting_for_approval",
]);

const SOURCE_LABEL: Record<string, string> = {
  web: "Web",
  mobile: "Phone",
  mac: "Mac",
  voice: "Voice",
};

// Messages further apart than this get a centered timestamp between them,
// the way Messages breaks up a thread.
const TIMESTAMP_GAP_MS = 60 * 60 * 1000;

function timestampLabel(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startOfToday.getTime() - new Date(date).setHours(0, 0, 0, 0)) / 86_400_000);
  if (dayDiff === 0) return `Today ${time}`;
  if (dayDiff === 1) return `Yesterday ${time}`;
  if (dayDiff < 7) return `${date.toLocaleDateString(undefined, { weekday: "long" })} ${time}`;
  return `${date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} ${time}`;
}

// The Tasks tab as a conversation: every request (typed here, spoken to the
// Mac, or tapped on the dashboard) is a message, and PAMI's result is the
// reply under it — with the composer pinned at the bottom so asking and
// reading the answer happen in the same place.
export function TaskList({
  userId,
  initialTasks,
  initialText,
  autoFocus,
  banner,
}: {
  userId: string;
  initialTasks: Task[];
  initialText?: string;
  autoFocus?: boolean;
  banner?: React.ReactNode;
}) {
  const tasks = useTasksRealtime(userId, initialTasks);
  const hydrated = useHydrated();
  // Picking a suggestion remounts the composer (via the counter key) with
  // that text prefilled — even if the same chip is picked twice.
  const [draft, setDraft] = useState({ text: initialText ?? "", n: 0 });
  const pickSuggestion = (text: string) => setDraft((d) => ({ text, n: d.n + 1 }));
  const bottomRef = useRef<HTMLDivElement>(null);

  // Realtime hands us newest-first; a conversation reads oldest-first.
  const thread = useMemo(() => [...tasks].reverse(), [tasks]);
  const activeCount = tasks.filter((t) => ACTIVE_STATUSES.has(t.status as TaskStatus)).length;

  // Follow the conversation: jump to the bottom on load and whenever a
  // task is added or changes state (a reply arriving).
  const signature = tasks.map((t) => `${t.id}:${t.status}`).join(",");
  const firstScroll = useRef(true);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: firstScroll.current ? "auto" : "smooth" });
    firstScroll.current = false;
  }, [signature]);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Tasks"
        className="mb-4"
        accessory={
          activeCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-tint/15 px-2.5 py-1 text-[13px] font-semibold text-tint">
              <span className="size-1.5 animate-pulse rounded-full bg-tint" />
              {activeCount} running
            </span>
          )
        }
      />

      {banner}

      {thread.length === 0 ? (
        <EmptyState onPick={pickSuggestion} />
      ) : (
        <ol className="flex flex-1 flex-col gap-4 pb-4">
          {thread.map((task, i) => {
            const previous = thread[i - 1];
            const showTime =
              !previous ||
              new Date(task.created_at).getTime() - new Date(previous.created_at).getTime() > TIMESTAMP_GAP_MS;
            return (
              <Fragment key={task.id}>
                {showTime && (
                  <li
                    aria-hidden={!hydrated}
                    className="min-h-4 pt-2 text-center text-[11px] font-medium text-muted-foreground"
                  >
                    {hydrated && timestampLabel(task.created_at)}
                  </li>
                )}
                <li>
                  {task.type === "ask" || task.type === "system_command" ? (
                    <Conversation task={task} userId={userId} hydrated={hydrated} />
                  ) : (
                    <ActionEvent task={task} hydrated={hydrated} />
                  )}
                </li>
              </Fragment>
            );
          })}
        </ol>
      )}
      <div ref={bottomRef} />

      {/* Rides just above the floating tab bar, or right on top of the
          keyboard while typing (the bar hides — see MobileTabBar). */}
      <div className="sticky bottom-[calc(var(--tabbar-space)+0.5rem)] z-[5] -mx-4 mt-2 bg-gradient-to-t from-background from-60% to-transparent px-4 pt-5 pb-1 sm:bottom-4">
        <AskPamiForm key={draft.n} userId={userId} initialText={draft.text} autoFocus={autoFocus || draft.n > 0} />
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-10 text-center">
      <span className="pami-gradient flex size-16 items-center justify-center rounded-[18px] text-black shadow-lg shadow-black/40">
        <Sparkles className="size-8" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-[20px] font-semibold">What should PAMI do?</p>
        <p className="max-w-xs text-[15px] text-muted-foreground">
          It has full control of your Mac — files, apps, settings, the web.
        </p>
      </div>
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-xl bg-card text-left">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className={cn(
              "flex min-h-11 items-center gap-3 px-4 py-2.5 text-left text-[15px] transition-colors active:bg-fill",
              i > 0 && "shadow-[inset_0_0.5px_0_var(--border)]",
            )}
          >
            <Sparkles className="size-4 shrink-0 text-tint" />
            {s}
          </button>
        ))}
      </div>
      <p className="text-[13px] text-muted-foreground">
        Start a message with <code className="rounded bg-fill px-1.5 py-0.5 font-mono">$</code> to run a shell command.
      </p>
    </div>
  );
}

function Conversation({ task, userId, hydrated }: { task: Task; userId: string; hydrated: boolean }) {
  const request = task.prompt || task.title;
  const isCommand = task.type === "system_command";

  return (
    <div className="flex flex-col gap-2">
      {/* The request */}
      <div className="flex flex-col items-end gap-1">
        <div
          className={cn(
            "max-w-[80%] rounded-[20px] rounded-br-[6px] bg-primary px-3.5 py-2 text-[17px] leading-snug break-words whitespace-pre-wrap text-primary-foreground",
            isCommand && "bg-ios-green/15 font-mono text-[14px] text-ios-green",
          )}
        >
          {isCommand && <span className="mr-1.5 opacity-60">$</span>}
          {request}
        </div>
        <span className="px-2 text-[11px] text-muted-foreground">
          {SOURCE_LABEL[task.source] ?? task.source}
          {hydrated && ` · ${formatRelativeTime(task.created_at)}`}
        </span>
      </div>

      {/* PAMI's reply */}
      <div className="flex items-start gap-2">
        <span className="pami-gradient mt-1 flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-black">
          P
        </span>
        <Reply task={task} onRetry={() => sendToPami(userId, isCommand ? `$ ${request}` : request)} />
      </div>
    </div>
  );
}

function Reply({ task, onRetry }: { task: Task; onRetry: () => void }) {
  const status = task.status as TaskStatus;

  if (status === "pending") {
    return <Working label="Sent to your Mac" />;
  }
  if (status === "acknowledged" || status === "in_progress") {
    return <Working label="Working on it" />;
  }
  if (status === "waiting_for_approval") {
    return <Working label="Waiting for your approval on Home" />;
  }
  if (status === "cancelled") {
    return <p className="pb-1 text-[15px] text-muted-foreground italic">{task.result || "Cancelled."}</p>;
  }

  const failed = status === "failed";
  return (
    <div className="flex min-w-0 max-w-[85%] flex-col items-start">
      <ResultText text={task.result || (failed ? "Something went wrong." : "Done.")} failed={failed} />
      <div className="mt-1 flex flex-wrap items-center gap-0.5">
        {task.result && <CopyButton text={task.result} />}
        {task.result && <ShareButton text={task.result} />}
        {task.result && !failed && <SpeakButton text={task.result} />}
        {failed && (
          <ReplyAction onClick={onRetry} icon={<RotateCcw className="size-3.5" />}>
            Retry
          </ReplyAction>
        )}
      </div>
    </div>
  );
}

function ResultText({ text, failed }: { text: string; failed?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 700;

  return (
    <div
      className={cn(
        "max-w-full rounded-[20px] rounded-bl-[6px] bg-card-2 px-3.5 py-2 text-[17px] leading-snug",
        failed && "bg-ios-red/15",
      )}
    >
      {failed && (
        <p className="mb-0.5 flex items-center gap-1.5 text-[13px] font-semibold text-destructive">
          <CircleAlert className="size-3.5" /> Couldn&rsquo;t finish
        </p>
      )}
      <p className={cn("break-words whitespace-pre-wrap select-text", long && !expanded && "line-clamp-[12]")}>{text}</p>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[15px] font-medium text-tint active:opacity-60"
        >
          {expanded ? "Show Less" : "Show More"}
        </button>
      )}
    </div>
  );
}

// The Messages typing indicator — three dots pulsing in a reply bubble.
function Working({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 items-center gap-1 rounded-[20px] rounded-bl-[6px] bg-card-2 px-3.5" aria-hidden>
        {[0, 160, 320].map((delay) => (
          <span
            key={delay}
            className="size-2 animate-bounce rounded-full bg-muted-foreground"
            style={{ animationDelay: `${delay}ms`, animationDuration: "1s" }}
          />
        ))}
      </div>
      <span className="text-[13px] text-muted-foreground">{label}…</span>
    </div>
  );
}

function ReplyAction({
  onClick,
  icon,
  children,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-muted-foreground transition-colors active:bg-fill"
    >
      {icon}
      {children}
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <ReplyAction
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        haptic();
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      icon={copied ? <Check className="size-3.5 text-ios-green" /> : <Copy className="size-3.5" />}
    >
      {copied ? "Copied" : "Copy"}
    </ReplyAction>
  );
}

// The iOS share sheet — send a reply to Messages, Notes, Mail… Hidden
// where the Web Share API isn't available (most desktop browsers).
function ShareButton({ text }: { text: string }) {
  const hydrated = useHydrated();
  if (!hydrated || typeof navigator.share !== "function") return null;
  return (
    <ReplyAction
      onClick={() => {
        navigator.share({ text }).catch(() => {
          // Dismissing the sheet rejects — not an error worth surfacing.
        });
      }}
      icon={<Share className="size-3.5" />}
    >
      Share
    </ReplyAction>
  );
}

// Reads one reply aloud on demand, independent of the automatic
// "speak responses" setting.
function SpeakButton({ text }: { text: string }) {
  const hydrated = useHydrated();
  const [speaking, setSpeaking] = useState(false);
  if (!hydrated || !("speechSynthesis" in window)) return null;
  return (
    <ReplyAction
      label={speaking ? "Stop reading" : "Read aloud"}
      onClick={() => {
        window.speechSynthesis.cancel();
        if (speaking) {
          setSpeaking(false);
          return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => setSpeaking(false);
        setSpeaking(true);
        window.speechSynthesis.speak(utterance);
      }}
      icon={speaking ? <Square className="size-3 fill-current" /> : <Volume2 className="size-3.5" />}
    >
      {speaking ? "Stop" : "Listen"}
    </ReplyAction>
  );
}

// Dashboard buttons (volume, notes, lock…) — shown as a centered system
// line, like Messages' "You named the conversation", rather than a full
// chat exchange, since there's no question to answer.
function ActionEvent({ task, hydrated }: { task: Task; hydrated: boolean }) {
  const status = task.status as TaskStatus;
  const active = ACTIVE_STATUSES.has(status);
  const failed = status === "failed";

  return (
    <div className="mx-auto flex max-w-[90%] flex-col items-center gap-0.5 text-center text-[13px]">
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <Zap className={cn("size-3.5 shrink-0", failed ? "text-destructive" : "text-tint")} fill="currentColor" />
        <span className="font-semibold text-foreground/90">{task.title}</span>
        <span>
          · {formatTaskType(task.type)}
          {hydrated && ` · ${formatRelativeTime(task.created_at)}`}
        </span>
      </p>
      {active ? (
        <p className="text-muted-foreground">Running…</p>
      ) : (
        task.result && (
          <p
            className={cn(
              "line-clamp-4 break-words whitespace-pre-wrap text-muted-foreground",
              failed && "text-destructive",
            )}
          >
            {task.result}
          </p>
        )
      )}
    </div>
  );
}
