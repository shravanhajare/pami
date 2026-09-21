"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type Approval = Database["public"]["Tables"]["approvals"]["Row"] & {
  tasks: { title: string; type: string } | null;
};

export function useApprovalsRealtime(userId: string, initial: Approval[]) {
  const [approvals, setApprovals] = useState<Approval[]>(initial);

  useEffect(() => {
    setApprovals(initial);
  }, [initial]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("approvals-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "approvals",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setApprovals((prev) => {
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as Partial<Approval>;
              return prev.filter((a) => a.id !== oldRow.id);
            }
            const row = payload.new as Approval;
            // Realtime payloads don't include embedded joins, so keep
            // whatever `tasks` we already fetched for this row.
            const existing = prev.find((a) => a.id === row.id);
            const merged = { ...row, tasks: existing?.tasks ?? null };
            const others = prev.filter((a) => a.id !== row.id);
            return row.status === "pending" ? [merged, ...others] : others;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return approvals;
}
