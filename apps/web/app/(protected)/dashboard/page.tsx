import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ApprovalsList } from "@/components/approvals-list";
import { MacStatus } from "@/components/mac-status";
import { QuickActions } from "@/components/quick-actions";
import { RecentActivity } from "@/components/recent-activity";
import { SUGGESTIONS } from "@/lib/suggestions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Asking happens on the Tasks tab (a conversation view); the dashboard is
  // the at-a-glance home: Mac status, a shortcut into asking, one-tap
  // controls, and the last few things PAMI did.
  const [{ data: tasks }, { data: approvals }, { data: devices }] = await Promise.all([
    supabase.from("tasks").select("*").order("created_at", { ascending: false }).limit(4),
    supabase
      .from("approvals")
      .select("*, tasks(title, type)")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase.from("devices").select("*").order("created_at", { ascending: false }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Good {timeOfDayGreeting()}.</h1>
          <p className="text-muted-foreground">What should your Mac do?</p>
        </div>
        <MacStatus userId={user!.id} initialDevices={devices ?? []} />
      </div>

      <ApprovalsList userId={user!.id} initialApprovals={approvals ?? []} />

      <section className="flex flex-col gap-3">
        <Link
          href="/tasks?ask"
          className="pami-glass group flex items-center gap-3 rounded-2xl px-4 py-3.5 shadow-lg shadow-black/20 transition-colors hover:border-primary/40"
        >
          <span className="pami-gradient flex size-8 shrink-0 items-center justify-center rounded-xl text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <span className="flex-1 text-muted-foreground">Tell PAMI what to do on your Mac…</span>
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          {SUGGESTIONS.slice(0, 4).map((s) => (
            <Link
              key={s}
              href={`/tasks?q=${encodeURIComponent(s)}`}
              className="shrink-0 rounded-full border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {s}
            </Link>
          ))}
        </div>
      </section>

      <QuickActions userId={user!.id} />

      <RecentActivity userId={user!.id} initialTasks={tasks ?? []} />
    </div>
  );
}

function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}
