"use client";

import { useEffect, useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type Approval = Database["public"]["Tables"]["approvals"]["Row"] & {
  tasks: { title: string; type: string } | null;
};

export function useApprovalsRealtime(userId: string, initial: Approval[]) {
  // Unique per mounted hook: realtime-js hands back the *same* channel for
  // a repeated topic, so two components on one page would otherwise share
  // (and tear down) each other's subscription.
  const channelId = useId();
  const [approvals, setApprovals] = useState<Approval[]>(initial);

  // Re-seed when the server sends fresh rows (navigation, router.refresh()
  // on resume) — adjusted during render rather than in an effect, so there's
  // no extra render showing the stale list first.
  const [seed, setSeed] = useState(initial);
  if (initial !== seed) {
    setSeed(initial);
    setApprovals(initial);
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`approvals-changes-${channelId}`)
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
  }, [userId, channelId]);

  return approvals;
}
