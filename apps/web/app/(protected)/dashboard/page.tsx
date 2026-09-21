import { createClient } from "@/lib/supabase/server";
import { ActivatePamiButton } from "@/components/activate-pami-button";
import { ApprovalsList } from "@/components/approvals-list";
import { AskPamiForm } from "@/components/ask-pami-form";
import { QuickActions } from "@/components/quick-actions";
import { TaskList } from "@/components/task-list";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware/proxy + the (protected) layout already guarantee `user` is
  // set here; this file focuses on the page's own data.
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: approvals } = await supabase
    .from("approvals")
    .select("*, tasks(title, type)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-8">
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

      <div>
        <h2 className="mb-3 text-lg font-medium">Recent tasks</h2>
        <TaskList userId={user!.id} initialTasks={tasks ?? []} />
      </div>
    </div>
  );
}

function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}
