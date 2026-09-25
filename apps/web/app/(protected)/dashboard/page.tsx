import Link from "next/link";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AddToHomeScreen } from "@/components/add-to-home-screen";
import { ApprovalsList } from "@/components/approvals-list";
import { Greeting } from "@/components/greeting";
import { MacStatus } from "@/components/mac-status";
import { AppleApps, QuickActions } from "@/components/quick-actions";
import { RecentActivity } from "@/components/recent-activity";
import { SendToMac } from "@/components/send-to-mac";
import { SUGGESTIONS } from "@/lib/suggestions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Asking happens on the Tasks tab (a conversation view); Home is the
  // at-a-glance screen: Mac status, a shortcut into asking, Control
  // Center-style controls, and the last few things PAMI did.
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
      <Greeting />

      <div className="flex flex-col gap-3">
        <ApprovalsList userId={user!.id} initialApprovals={approvals ?? []} />
        <MacStatus userId={user!.id} initialDevices={devices ?? []} />
        <AddToHomeScreen />
      </div>

      <section className="flex flex-col gap-3">
        {/* Styled as a search field (the iOS idiom for "type here to
            start"); it's a link so the keyboard opens on Tasks, where the
            conversation is. */}
        <Link
          href="/tasks?ask"
          className="pressable flex h-12 items-center gap-2.5 rounded-2xl bg-card px-3.5 text-[17px] text-muted-foreground"
        >
          <Sparkles className="size-5 shrink-0 text-tint" />
          <span className="flex-1 truncate">Ask PAMI to do anything…</span>
        </Link>
        <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {SUGGESTIONS.slice(0, 4).map((s) => (
            <Link
              key={s}
              href={`/tasks?q=${encodeURIComponent(s)}`}
              className="pressable shrink-0 snap-start rounded-full bg-card px-3.5 py-2 text-[15px] text-foreground/90"
            >
              {s}
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-1.5">
        <h2 className="px-4 text-[13px] tracking-wide text-muted-foreground uppercase">Controls</h2>
        <QuickActions />
      </section>

      <section className="flex flex-col gap-1.5">
        <h2 className="px-4 text-[13px] tracking-wide text-muted-foreground uppercase">Continuity</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <SendToMac />
          <AppleApps />
        </div>
      </section>

      <RecentActivity userId={user!.id} initialTasks={tasks ?? []} />
    </div>
  );
}
