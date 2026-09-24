"use client";

import Link from "next/link";
import { cn } from "cn";
import { useTasksRealtime } from "@/hooks/use-tasks-realtime";
import type { Database } from "@/lib/supabase/database.types";
import { formatRelativeTime, formatTaskType } from "@/lib/format-task";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

const ACTIVE = new Set(["pending", "acknowledged", "in_progress", "waiting_for_approval"]);

export function RecentActivity({ userId, initialTasks }: { userId: string; initialTasks: Task[] }) {
  const tasks = useTasksRealtime(userId, initialTasks).slice(0, 4);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Recent</h2>
        <Link href="/tasks" className="text-xs text-muted-foreground hover:text-foreground">
          View all →
        </Link>
      </div>
      {tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Nothing yet — your requests and PAMI&rsquo;s replies will show up here.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card/50">
          {tasks.map((task) => {
            const active = ACTIVE.has(task.status);
            const failed = task.status === "failed";
            return (
              <li key={task.id}>
                <Link href="/tasks" className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/40">
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      active ? "animate-pulse bg-primary" : failed ? "bg-destructive" : "bg-emerald-400",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {active ? "Working on it…" : task.result || formatTaskType(task.type)}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatRelativeTime(task.created_at)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
