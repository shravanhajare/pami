"use client";

import { Laptop } from "lucide-react";
import { useDevicesRealtime } from "@/hooks/use-devices-realtime";
import { DeviceCard } from "@/components/device-card";
import { IconBadge, ListRow, ListSection } from "@/components/ui/list";
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
  const active = devices.filter((d) => d.status !== "revoked");
  const revoked = devices.filter((d) => d.status === "revoked");

  if (devices.length === 0) {
    return (
      <p className="px-4 text-center text-[15px] text-muted-foreground">
        No Macs paired yet — enter the code from the PAMI menu bar app below.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {active.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {active.map((device) => (
            <DeviceCard key={device.id} device={device} />
          ))}
        </div>
      )}

      {/* Revoked Macs are history, not something to manage — one compact
          row each instead of a full card. */}
      {revoked.length > 0 && (
        <ListSection title="Revoked" footer="These Macs can no longer run tasks. Pair again to restore one.">
          {revoked.map((device) => (
            <ListRow
              key={device.id}
              icon={<IconBadge icon={Laptop} />}
              title={device.name}
              detail={device.os_version ?? undefined}
            />
          ))}
        </ListSection>
      )}
    </div>
  );
}
