import { createClient } from "@/lib/supabase/server";
import { PairDeviceForm } from "@/components/pair-device-form";
import { DeviceList } from "@/components/device-list";
import { Separator } from "@/components/ui/separator";

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
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mac</h1>
        <p className="text-muted-foreground">
          Manage the Macs paired with your PAMI account.
        </p>
      </div>

      <PairDeviceForm />

      <Separator />

      <DeviceList userId={user!.id} initialDevices={devices ?? []} />
    </div>
  );
}
