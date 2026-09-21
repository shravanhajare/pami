"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApprovalsRealtime } from "@/hooks/use-approvals-realtime";
import type { Database, Json } from "@/lib/supabase/database.types";

type Approval = Database["public"]["Tables"]["approvals"]["Row"] & {
  tasks: { title: string; type: string } | null;
};

function describe(action: Json | null): string {
  if (action && typeof action === "object" && !Array.isArray(action) && "command" in action) {
    return String((action as { command: unknown }).command);
  }
  return JSON.stringify(action);
}

export function ApprovalsList({
  userId,
  initialApprovals,
}: {
  userId: string;
  initialApprovals: Approval[];
}) {
  const approvals = useApprovalsRealtime(userId, initialApprovals);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function resolve(id: string, status: "approved" | "denied") {
    setPendingId(id);
    const supabase = createClient();
    // Permitted by the narrow RLS policy: a pending approval may only ever
    // move to 'approved' or 'denied', nothing else, directly from the browser.
    await supabase.from("approvals").update({ status }).eq("id", id);
    setPendingId(null);
  }

  if (approvals.length === 0) return null;

  return (
    <Card className="border-amber-500/50">
      <CardHeader>
        <CardTitle className="text-base">Waiting for your approval</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {approvals.map((approval) => (
          <div
            key={approval.id}
            className="flex items-center justify-between gap-4 rounded-md border px-4 py-3"
          >
            <div>
              <p className="font-medium">{approval.tasks?.title ?? "Task"}</p>
              <code className="text-xs text-muted-foreground">
                {describe(approval.requested_action)}
              </code>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={pendingId === approval.id}
                onClick={() => resolve(approval.id, "approved")}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={pendingId === approval.id}
                onClick={() => resolve(approval.id, "denied")}
              >
                Deny
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
