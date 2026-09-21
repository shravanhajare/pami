"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

export function useTasksRealtime(userId: string, initial: Task[]) {
  const [tasks, setTasks] = useState<Task[]>(initial);

  useEffect(() => {
    setTasks(initial);
  }, [initial]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("tasks-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setTasks((prev) => {
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as Partial<Task>;
              return prev.filter((t) => t.id !== oldRow.id);
            }
            const row = payload.new as Task;
            const exists = prev.some((t) => t.id === row.id);
            const next = exists
              ? prev.map((t) => (t.id === row.id ? row : t))
              : [row, ...prev];
            return next.sort(
              (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime(),
            );
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return tasks;
}
