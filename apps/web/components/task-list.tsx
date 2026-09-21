"use client";

import { Badge } from "@/components/ui/badge";
import { useTasksRealtime } from "@/hooks/use-tasks-realtime";
import type { Database, TaskStatus } from "@/lib/supabase/database.types";
import { formatTaskType, formatRelativeTime } from "@/lib/format-task";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

const STATUS_VARIANT: Record<TaskStatus, "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  acknowledged: "secondary",
  in_progress: "default",
  waiting_for_approval: "secondary",
  completed: "default",
  failed: "destructive",
  cancelled: "secondary",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "Pending",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  waiting_for_approval: "Needs approval",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

// Anything still moving through the pipeline vs. a settled outcome — the
// split that actually matters when you're scanning for "is something
// waiting on me right now."
const ACTIVE_STATUSES = new Set<TaskStatus>([
  "pending",
  "acknowledged",
  "in_progress",
  "waiting_for_approval",
]);

export function TaskList({
  userId,
  initialTasks,
}: {
  userId: string;
  initialTasks: Task[];
}) {
  const tasks = useTasksRealtime(userId, initialTasks);

  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">No tasks yet.</p>;
  }

  const active = tasks.filter((t) => ACTIVE_STATUSES.has(t.status as TaskStatus));
  const history = tasks.filter((t) => !ACTIVE_STATUSES.has(t.status as TaskStatus));

  return (
    <div className="flex flex-col gap-6">
      {active.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Active ({active.length})
          </h3>
          <TaskRows tasks={active} />
        </section>
      )}
      {history.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">History</h3>
          <TaskRows tasks={history} />
        </section>
      )}
    </div>
  );
}

function TaskRows({ tasks }: { tasks: Task[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => (
        <li key={task.id} className="rounded-md border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{task.title}</p>
              <p className="text-xs text-muted-foreground">
                {formatTaskType(task.type)} · via {task.source} ·{" "}
                {formatRelativeTime(task.created_at)}
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[task.status as TaskStatus]} className="shrink-0">
              {STATUS_LABEL[task.status as TaskStatus] ?? task.status}
            </Badge>
          </div>
          {task.result && (
            <p className="mt-2 line-clamp-6 whitespace-pre-wrap rounded bg-muted p-2 text-sm">
              {task.result}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
