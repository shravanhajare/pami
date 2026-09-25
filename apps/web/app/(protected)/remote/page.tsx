import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { RemoteDesktopCard } from "@/components/remote-desktop-card";

export default async function RemotePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // This page has fewer queries than its siblings, so it finishes rendering
  // before the layout's own redirect aborts it — without this guard an
  // unauthenticated request throws on user.id before the 307 is sent.
  if (!user) redirect("/login");

  const { data: devices } = await supabase
    .from("devices")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Remote" subtitle="See and control your Mac’s screen from here." />

      <RemoteDesktopCard userId={user.id} initialDevices={devices ?? []} />
    </div>
  );
}
