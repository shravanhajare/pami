"use client";

import Link from "next/link";
import { Check, CircleAlert, Loader2, MessageCircle, Zap } from "lucide-react";
import { cn } from "cn";
import { useHydrated } from "@/hooks/use-hydrated";
import { useTasksRealtime } from "@/hooks/use-tasks-realtime";
import type { Database } from "@/lib/supabase/database.types";
import { formatRelativeTime, formatTaskType } from "@/lib/format-task";
import { ListSection } from "@/components/ui/list";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

const ACTIVE = new Set(["pending", "acknowledged", "in_progress", "waiting_for_approval"]);

export function RecentActivity({ userId, initialTasks }: { userId: string; initialTasks: Task[] }) {
  const tasks = useTasksRealtime(userId, initialTasks).slice(0, 4);
  const hydrated = useHydrated();

  return (
    <ListSection
      title="Recent"
      action={
        <Link href="/tasks" className="text-[15px] text-tint active:opacity-60">
          See All
        </Link>
      }
    >
      {tasks.length === 0 ? (
        <p className="px-4 py-8 text-center text-[15px] text-muted-foreground">
          Nothing yet — your requests and PAMI&rsquo;s replies will show up here.
        </p>
      ) : (
        tasks.map((task) => {
          const active = ACTIVE.has(task.status);
          const failed = task.status === "failed" || task.status === "cancelled";
          const conversational = task.type === "ask" || task.type === "system_command";
          const Icon = active ? Loader2 : failed ? CircleAlert : conversational ? MessageCircle : task.status === "completed" ? Check : Zap;
          return (
            <Link
              key={task.id}
              href="/tasks"
              className="group/row flex items-center gap-3 pl-4 transition-colors active:bg-fill"
            >
              <span
                className={cn(
                  "flex size-[29px] shrink-0 items-center justify-center rounded-full",
                  active ? "bg-tint/15 text-tint" : failed ? "bg-ios-red/15 text-ios-red" : "bg-ios-green/15 text-ios-green",
                )}
              >
                <Icon className={cn("size-4", active && "animate-spin")} strokeWidth={2.25} />
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 group-not-first/row:shadow-[inset_0_0.5px_0_var(--border)]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] leading-snug">{task.title}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {active ? "Working on it…" : task.result || formatTaskType(task.type)}
                  </span>
                </span>
                <span className="shrink-0 self-start pt-0.5 text-[13px] text-muted-foreground">
                  {hydrated && formatRelativeTime(task.created_at)}
                </span>
              </span>
            </Link>
          );
        })
      )}
    </ListSection>
  );
}
