"use client";

import { Badge } from "@/components/ui/badge";
import { useTasksRealtime } from "@/hooks/use-tasks-realtime";
import type { Database, TaskStatus } from "@/lib/supabase/database.types";

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

  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => (
        <li key={task.id} className="rounded-md border px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">{task.title}</p>
              <p className="text-xs text-muted-foreground">
                via {task.source} · {new Date(task.created_at).toLocaleString()}
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[task.status as TaskStatus]}>
              {task.status}
            </Badge>
          </div>
          {task.result && (
            <p className="mt-2 whitespace-pre-wrap rounded bg-muted p-2 text-sm">
              {task.result}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
