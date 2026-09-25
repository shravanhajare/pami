import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { PairDeviceForm } from "@/components/pair-device-form";
import { DeviceList } from "@/components/device-list";

export default async function MacPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: devices } = await supabase
    .from("devices")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-7">
      <PageHeader title="Mac" subtitle="The Macs paired with your PAMI account." />

      <DeviceList userId={user!.id} initialDevices={devices ?? []} />

      <PairDeviceForm />
    </div>
  );
}
