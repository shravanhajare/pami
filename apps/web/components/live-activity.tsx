"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy, Loader2, X } from "lucide-react";
import { cn } from "cn";
import { createClient } from "@/lib/supabase/client";
import { haptic } from "@/lib/haptics";

type TaskFields = { type: string; title: string; prompt?: string };
type RunOptions = {
  // What the island calls it — defaults to the task title.
  label?: string;
  // Show a Copy button on the result (clipboard, now playing…).
  copyable?: boolean;
};
type Status = "sending" | "running" | "queued" | "done" | "failed";
type Activity = {
  key: number;
  id?: string;
  label: string;
  status: Status;
  result?: string;
  copyable?: boolean;
};

type RunOnMac = (fields: TaskFields, options?: RunOptions) => Promise<{ error: string | null }>;

const LiveActivityContext = createContext<RunOnMac | null>(null);

// Sends a task to the Mac and follows it in the island at the top of the
// screen — so a tap on "Battery" answers right there instead of making you
// go read it in Tasks.
export function useRunOnMac(): RunOnMac {
  const run = useContext(LiveActivityContext);
  if (!run) throw new Error("useRunOnMac must be used inside <LiveActivityProvider>");
  return run;
}

// How long before an unanswered task is presumed stuck behind an offline
// or sleeping Mac, and how long finished results stay up.
const QUEUED_AFTER_MS = 15_000;
const DISMISS_AFTER_MS = { done: 4_000, copyable: 9_000, failed: 6_000, queued: 4_500 };
const POLL_MS = 3_000;

export function LiveActivityProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const nextKey = useRef(0);
  const channelId = useId();

  const remove = useCallback((key: number) => {
    setActivities((prev) => prev.filter((a) => a.key !== key));
  }, []);

  // Applies a task row's state to whichever activity is following it.
  const applyRow = useCallback((row: { id: string; status: string; result: string | null }) => {
    setActivities((prev) =>
      prev.map((a) => {
        if (a.id !== row.id || a.status === "done" || a.status === "failed") return a;
        if (row.status === "completed" || row.status === "failed" || row.status === "cancelled") {
          const failed = row.status !== "completed";
          return {
            ...a,
            status: failed ? "failed" : "done",
            result: row.result || (failed ? "Couldn't finish that." : "Done."),
          };
        }
        if (row.status === "acknowledged" || row.status === "in_progress") {
          return a.status === "queued" ? a : { ...a, status: "running" };
        }
        return a;
      }),
    );
  }, []);

  // Each settled state gets one dismiss timer; it only removes the
  // activity if it's still in that state (a queued task that then
  // completes shows its result for the full time instead).
  const scheduled = useRef(new Set<string>());
  useEffect(() => {
    for (const a of activities) {
      const delay =
        a.status === "failed"
          ? DISMISS_AFTER_MS.failed
          : a.status === "done"
            ? a.copyable
              ? DISMISS_AFTER_MS.copyable
              : DISMISS_AFTER_MS.done
            : a.status === "queued"
              ? DISMISS_AFTER_MS.queued
              : null;
      const token = `${a.key}:${a.status}`;
      if (delay === null || scheduled.current.has(token)) continue;
      scheduled.current.add(token);
      setTimeout(() => {
        setActivities((prev) => prev.filter((x) => !(x.key === a.key && x.status === a.status)));
      }, delay);
    }
  }, [activities]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`live-activity-${channelId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks", filter: `user_id=eq.${userId}` },
        (payload) => applyRow(payload.new as { id: string; status: string; result: string | null }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, channelId, applyRow]);

  // Backstop for missed realtime events — iOS suspends the socket whenever
  // the Home Screen app is backgrounded, even for a few seconds.
  const watchedIds = activities
    .filter((a) => a.id && (a.status === "sending" || a.status === "running"))
    .map((a) => a.id!)
    .join(",");
  useEffect(() => {
    if (!watchedIds) return;
    const supabase = createClient();
    const poll = async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, status, result")
        .in("id", watchedIds.split(","));
      data?.forEach(applyRow);
    };
    const interval = setInterval(poll, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [watchedIds, applyRow]);

  const run = useCallback<RunOnMac>(
    async (fields, options = {}) => {
      haptic();
      const key = nextKey.current++;
      setActivities((prev) => [
        ...prev,
        { key, label: options.label ?? fields.title, status: "sending", copyable: options.copyable },
      ]);

      const supabase = createClient();
      const { data, error } = await supabase
        .from("tasks")
        .insert({ user_id: userId, source: "web", status: "pending", ...fields })
        .select("id")
        .single();

      if (error || !data) {
        const message = error?.message ?? "Couldn't send that.";
        setActivities((prev) =>
          prev.map((a) => (a.key === key ? { ...a, status: "failed", result: message } : a)),
        );
        return { error: message };
      }

      setActivities((prev) => prev.map((a) => (a.key === key ? { ...a, id: data.id } : a)));
      setTimeout(() => {
        setActivities((prev) =>
          prev.map((a) =>
            a.key === key && (a.status === "sending" || a.status === "running")
              ? { ...a, status: "queued" }
              : a,
          ),
        );
      }, QUEUED_AFTER_MS);
      return { error: null };
    },
    [userId],
  );

  // Newest first: a fresh tap takes over the island; older ones keep
  // running and land in Tasks either way.
  const current = activities.at(-1);

  return (
    <LiveActivityContext.Provider value={run}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-3"
        style={{ top: "calc(env(safe-area-inset-top) + 0.5rem)" }}
      >
        {current && <Island key={current.key} activity={current} onDismiss={() => remove(current.key)} />}
      </div>
    </LiveActivityContext.Provider>
  );
}

function Island({ activity, onDismiss }: { activity: Activity; onDismiss: () => void }) {
  const { status, label, result, copyable } = activity;
  const expanded = status === "done" || status === "failed" || status === "queued";
  const [copied, setCopied] = useState(false);

  const subtitle =
    status === "sending"
      ? "Sending to your Mac…"
      : status === "running"
        ? "Working on it…"
        : status === "queued"
          ? "Your Mac hasn't picked this up yet — it'll run when it's back online."
          : result;

  return (
    <div
      className={cn(
        "pointer-events-auto flex max-w-[400px] animate-in items-center gap-3 bg-black text-white shadow-2xl shadow-black/50 ring-1 ring-white/10 duration-300 fade-in zoom-in-90",
        expanded ? "w-full rounded-[28px] p-3 pr-2" : "rounded-full py-2 pr-4 pl-2",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center self-start rounded-full",
          status === "done" ? "bg-ios-green" : status === "failed" ? "bg-ios-red" : "bg-white/15",
        )}
      >
        {status === "done" ? (
          <Check className="size-4.5" strokeWidth={3} />
        ) : status === "failed" ? (
          <X className="size-4.5" strokeWidth={3} />
        ) : status === "queued" ? (
          <span className="size-2 rounded-full bg-ios-orange" />
        ) : (
          <Loader2 className="size-4.5 animate-spin text-primary" />
        )}
      </span>

      <div className={cn("min-w-0", expanded && "flex-1")}>
        <p className="truncate text-[15px] leading-5 font-semibold">{label}</p>
        <p
          className={cn(
            "text-[13px] leading-[18px] text-white/70",
            expanded ? "line-clamp-4 break-words whitespace-pre-wrap" : "truncate",
          )}
        >
          {subtitle}
        </p>
        {expanded && result && result.length > 160 && (
          <Link href="/tasks" onClick={onDismiss} className="mt-1 inline-block text-[13px] font-medium text-primary">
            Open in Tasks
          </Link>
        )}
      </div>

      {expanded && (
        <div className="flex shrink-0 items-center gap-1 self-start">
          {copyable && status === "done" && result && (
            <button
              type="button"
              aria-label="Copy result"
              onClick={async () => {
                await navigator.clipboard.writeText(result);
                haptic();
                setCopied(true);
              }}
              className="flex h-8 items-center gap-1 rounded-full bg-white/15 px-3 text-[13px] font-semibold active:bg-white/25"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismiss}
            className="flex size-8 items-center justify-center rounded-full text-white/60 active:bg-white/15"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
