"use client";

import { useEffect, useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

export function useTasksRealtime(userId: string, initial: Task[]) {
  // Unique per mounted hook: realtime-js hands back the *same* channel for
  // a repeated topic, so two components on one page would otherwise share
  // (and tear down) each other's subscription.
  const channelId = useId();
  const [tasks, setTasks] = useState<Task[]>(initial);

  // Re-seed when the server sends fresh rows (navigation, router.refresh()
  // on resume) — adjusted during render rather than in an effect, so there's
  // no extra render showing the stale list first.
  const [seed, setSeed] = useState(initial);
  if (initial !== seed) {
    setSeed(initial);
    setTasks(initial);
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`tasks-changes-${channelId}`)
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
  }, [userId, channelId]);

  return tasks;
}
