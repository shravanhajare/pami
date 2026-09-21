import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ActivatePamiButton } from "@/components/activate-pami-button";
import { ApprovalsList } from "@/components/approvals-list";
import { AskPamiForm } from "@/components/ask-pami-form";
import { QuickActions } from "@/components/quick-actions";
import { VoiceResponseSpeaker } from "@/components/voice-response-speaker";

const ACTIVE_STATUSES = ["pending", "acknowledged", "in_progress", "waiting_for_approval"];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware/proxy + the (protected) layout already guarantee `user` is
  // set here; this file focuses on the page's own data. Tasks themselves
  // live on their own tab (see (protected)/tasks/page.tsx) — this is just
  // enough task data for the "N active" teaser below and to stop
  // VoiceResponseSpeaker re-reading already-finished tasks on mount.
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, status")
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: approvals } = await supabase
    .from("approvals")
    .select("*, tasks(title, type)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const { data: profile } = await supabase
    .from("profiles")
    .select("voice_responses_enabled")
    .eq("id", user!.id)
    .single();

  const activeCount = (tasks ?? []).filter((t) => ACTIVE_STATUSES.includes(t.status)).length;

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <VoiceResponseSpeaker
        userId={user!.id}
        initialEnabled={profile?.voice_responses_enabled ?? true}
        knownTaskIds={(tasks ?? []).map((t) => t.id)}
      />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Good {timeOfDayGreeting()}.
        </h1>
        <p className="text-muted-foreground">Ready when you are.</p>
      </div>

      <ApprovalsList userId={user!.id} initialApprovals={approvals ?? []} />

      <ActivatePamiButton userId={user!.id} />

      <AskPamiForm userId={user!.id} />

      <QuickActions userId={user!.id} />

      <Link
        href="/tasks"
        className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition-colors hover:bg-accent"
      >
        <span className="font-medium">
          {activeCount > 0 ? `${activeCount} active task${activeCount === 1 ? "" : "s"}` : "Tasks"}
        </span>
        <span className="text-muted-foreground">View all →</span>
      </Link>
    </div>
  );
}

function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}
