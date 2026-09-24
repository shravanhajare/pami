"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CircleAlert, Copy, RotateCcw, Sparkles, Zap } from "lucide-react";
import { cn } from "cn";
import { useTasksRealtime } from "@/hooks/use-tasks-realtime";
import type { Database, TaskStatus } from "@/lib/supabase/database.types";
import { formatTaskType, formatRelativeTime } from "@/lib/format-task";
import { SUGGESTIONS } from "@/lib/suggestions";
import { AskPamiForm, sendToPami } from "@/components/ask-pami-form";

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

// The Tasks tab as a conversation: every request (typed here, spoken to the
// Mac, or tapped on the dashboard) is a message, and PAMI's result is the
// reply under it — with the composer pinned at the bottom so asking and
// reading the answer happen in the same place.
export function TaskList({
  userId,
  initialTasks,
  initialText,
  autoFocus,
}: {
  userId: string;
  initialTasks: Task[];
  initialText?: string;
  autoFocus?: boolean;
}) {
  const tasks = useTasksRealtime(userId, initialTasks);
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
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Ask anything — PAMI does it on your Mac and replies here.
          </p>
        </div>
        {activeCount > 0 && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" />
            {activeCount} running
          </span>
        )}
      </div>

      {thread.length === 0 ? (
        <EmptyState onPick={pickSuggestion} />
      ) : (
        <ol className="flex flex-1 flex-col gap-5 pb-4">
          {thread.map((task) => (
            <li key={task.id}>
              {task.type === "ask" || task.type === "system_command" ? (
                <Conversation task={task} userId={userId} />
              ) : (
                <ActionEvent task={task} />
              )}
            </li>
          ))}
        </ol>
      )}
      <div ref={bottomRef} />

      {/* Pinned above the mobile tab bar (≈4.5rem + safe area) and to the
          bottom of the viewport on wider screens. */}
      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[5] -mx-1 mt-2 bg-gradient-to-t from-background via-background/95 to-transparent px-1 pt-4 pb-1 sm:bottom-4">
        <AskPamiForm key={draft.n} userId={userId} initialText={draft.text} autoFocus={autoFocus || draft.n > 0} />
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-12 text-center">
      <span className="pami-gradient flex size-12 items-center justify-center rounded-2xl text-primary-foreground">
        <Sparkles className="size-6" />
      </span>
      <div>
        <p className="font-medium">What should PAMI do?</p>
        <p className="text-sm text-muted-foreground">
          It has full control of your Mac — files, apps, settings, the web.
        </p>
      </div>
      <div className="flex max-w-lg flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-full border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Conversation({ task, userId }: { task: Task; userId: string }) {
  const request = task.prompt || task.title;
  const isCommand = task.type === "system_command";

  return (
    <div className="flex flex-col gap-2">
      {/* The request */}
      <div className="flex flex-col items-end gap-1">
        <div
          className={cn(
            "max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-[15px] whitespace-pre-wrap text-primary-foreground",
            isCommand && "bg-emerald-500/15 font-mono text-sm text-emerald-200",
          )}
        >
          {isCommand && <span className="mr-1.5 opacity-60">$</span>}
          {request}
        </div>
        <span className="px-1 text-[11px] text-muted-foreground">
          {SOURCE_LABEL[task.source] ?? task.source} · {formatRelativeTime(task.created_at)}
        </span>
      </div>

      {/* PAMI's reply */}
      <div className="flex items-start gap-2.5">
        <span className="pami-gradient mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-primary-foreground">
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
    return <Working label="Sent to your Mac…" />;
  }
  if (status === "acknowledged" || status === "in_progress") {
    return <Working label="Working on it…" />;
  }
  if (status === "waiting_for_approval") {
    return <Working label="Waiting for approval on the dashboard" />;
  }
  if (status === "cancelled") {
    return <p className="pt-1 text-sm text-muted-foreground italic">{task.result || "Cancelled."}</p>;
  }

  const failed = status === "failed";
  return (
    <div className="min-w-0 flex-1">
      <ResultText text={task.result || (failed ? "Something went wrong." : "Done.")} failed={failed} />
      <div className="mt-1 flex items-center gap-1">
        {task.result && <CopyButton text={task.result} />}
        {failed && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <RotateCcw className="size-3" /> Retry
          </button>
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
        "rounded-2xl rounded-tl-md border bg-card px-3.5 py-2.5 text-[15px] leading-relaxed",
        failed && "border-destructive/30 bg-destructive/10",
      )}
    >
      {failed && (
        <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-destructive">
          <CircleAlert className="size-3.5" /> Couldn&rsquo;t finish
        </p>
      )}
      <p className={cn("break-words whitespace-pre-wrap", long && !expanded && "line-clamp-[12]")}>{text}</p>
      {long && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-medium text-primary hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function Working({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border bg-card px-3.5 py-2.5 text-sm text-muted-foreground">
      <span className="flex gap-1">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-bounce rounded-full bg-primary"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
      {label}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// Dashboard buttons (volume, notes, lock…) — shown as one compact line
// rather than a full chat exchange, since there's no question to answer.
function ActionEvent({ task }: { task: Task }) {
  const status = task.status as TaskStatus;
  const active = ACTIVE_STATUSES.has(status);
  const failed = status === "failed";

  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-dashed px-3 py-2 text-sm">
      <Zap className={cn("mt-0.5 size-4 shrink-0", failed ? "text-destructive" : "text-primary")} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium">{task.title}</span>
          <span className="text-[11px] text-muted-foreground">
            {formatTaskType(task.type)} · {formatRelativeTime(task.created_at)}
          </span>
        </p>
        {active ? (
          <p className="text-muted-foreground">Running…</p>
        ) : (
          task.result && (
            <p className={cn("line-clamp-4 whitespace-pre-wrap text-muted-foreground", failed && "text-destructive")}>
              {task.result}
            </p>
          )
        )}
      </div>
    </div>
  );
}
