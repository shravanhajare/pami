"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { haptic } from "@/lib/haptics";
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
    haptic();
    setPendingId(id);
    const supabase = createClient();
    // Permitted by the narrow RLS policy: a pending approval may only ever
    // move to 'approved' or 'denied', nothing else, directly from the browser.
    await supabase.from("approvals").update({ status }).eq("id", id);
    setPendingId(null);
  }

  if (approvals.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      {approvals.map((approval) => (
        <div
          key={approval.id}
          className="animate-in rounded-2xl bg-card p-4 ring-1 ring-ios-orange/40 fade-in slide-in-from-top-2"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ios-orange/15 text-ios-orange">
              <ShieldAlert className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-ios-orange">Needs your approval</p>
              <p className="text-[17px] leading-snug font-semibold">{approval.tasks?.title ?? "Task"}</p>
            </div>
          </div>
          <code className="mt-3 block max-h-32 overflow-auto rounded-xl bg-card-2 px-3 py-2 font-mono text-[13px] leading-relaxed break-all whitespace-pre-wrap text-foreground/90">
            {describe(approval.requested_action)}
          </code>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={pendingId === approval.id}
              onClick={() => resolve(approval.id, "denied")}
              className="pressable h-11 rounded-xl bg-fill text-[17px] font-semibold text-destructive disabled:opacity-40"
            >
              Deny
            </button>
            <button
              type="button"
              disabled={pendingId === approval.id}
              onClick={() => resolve(approval.id, "approved")}
              className="pressable h-11 rounded-xl bg-primary text-[17px] font-semibold text-primary-foreground disabled:opacity-40"
            >
              Approve
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
