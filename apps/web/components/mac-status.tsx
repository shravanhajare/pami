"use client";

import Link from "next/link";
import { cn } from "cn";
import { useDevicesRealtime } from "@/hooks/use-devices-realtime";
import type { Database } from "@/lib/supabase/database.types";

type Device = Database["public"]["Tables"]["devices"]["Row"];

// One glance answer to "will my request actually run right now?".
export function MacStatus({ userId, initialDevices }: { userId: string; initialDevices: Device[] }) {
  const devices = useDevicesRealtime(userId, initialDevices).filter((d) => d.status === "trusted");
  const online = devices.find((d) => d.isOnline);

  if (devices.length === 0) {
    return (
      <Link href="/mac" className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
        Pair your Mac →
      </Link>
    );
  }

  const device = online ?? devices[0];
  const paused = online?.state === "paused";

  return (
    <Link
      href="/mac"
      className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors hover:bg-accent"
    >
      <span
        className={cn(
          "size-2 rounded-full",
          !online ? "bg-muted-foreground/50" : paused ? "bg-amber-400" : "bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/60",
        )}
      />
      <span className="max-w-40 truncate font-medium">{device.name}</span>
      <span className="text-muted-foreground">{!online ? "Offline" : paused ? "Paused" : "Online"}</span>
    </Link>
  );
}
