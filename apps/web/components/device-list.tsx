"use client";

import { useDevicesRealtime } from "@/hooks/use-devices-realtime";
import { DeviceCard } from "@/components/device-card";
import type { Database } from "@/lib/supabase/database.types";

type Device = Database["public"]["Tables"]["devices"]["Row"];

export function DeviceList({
  userId,
  initialDevices,
}: {
  userId: string;
  initialDevices: Device[];
}) {
  const devices = useDevicesRealtime(userId, initialDevices);

  if (devices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No Macs paired yet. Open the PAMI menu bar app and enter the code it
        shows below.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {devices.map((device) => (
        <DeviceCard key={device.id} device={device} />
      ))}
    </div>
  );
}
