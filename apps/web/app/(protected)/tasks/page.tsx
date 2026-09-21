import { createClient } from "@/lib/supabase/server";
import { TaskList } from "@/components/task-list";

export default async function TasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="text-muted-foreground">Everything PAMI&rsquo;s working on or has done.</p>
      </div>

      <TaskList userId={user!.id} initialTasks={tasks ?? []} />
    </div>
  );
}
