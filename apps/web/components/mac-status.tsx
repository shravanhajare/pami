"use client";

import Link from "next/link";
import { ChevronRight, Laptop, Plus } from "lucide-react";
import { cn } from "cn";
import { useDevicesRealtime } from "@/hooks/use-devices-realtime";
import { useHydrated } from "@/hooks/use-hydrated";
import type { Database } from "@/lib/supabase/database.types";
import { formatRelativeTime } from "@/lib/format-task";

type Device = Database["public"]["Tables"]["devices"]["Row"];

// One glance answer to "will my request actually run right now?" — a
// widget-style card at the top of Home.
export function MacStatus({ userId, initialDevices }: { userId: string; initialDevices: Device[] }) {
  const devices = useDevicesRealtime(userId, initialDevices).filter((d) => d.status === "trusted");
  const online = devices.find((d) => d.isOnline);
  const hydrated = useHydrated();

  if (devices.length === 0) {
    return (
      <Link href="/mac" className="pressable flex items-center gap-3 rounded-2xl bg-card p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tint/15 text-tint">
          <Plus className="size-5" strokeWidth={2.5} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-semibold">Pair your Mac</span>
          <span className="block text-[13px] text-muted-foreground">
            Open the PAMI menu bar app and enter its code.
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
      </Link>
    );
  }

  const device = online ?? devices[0];
  const paused = online?.state === "paused";
  const state = !online ? "Offline" : paused ? "Paused" : "Online";
  const detail = !online
    ? device.last_seen_at
      ? hydrated
        ? `Last seen ${formatRelativeTime(device.last_seen_at)}`
        : "Last seen recently"
      : "Not connected yet"
    : paused
      ? "Paused from the menu bar"
      : "Ready for requests";

  return (
    <Link href="/mac" className="pressable flex items-center gap-3 rounded-2xl bg-card p-4">
      <span
        className={cn(
          "relative flex size-11 shrink-0 items-center justify-center rounded-full",
          !online ? "bg-fill text-muted-foreground" : paused ? "bg-ios-orange/15 text-ios-orange" : "bg-ios-green/15 text-ios-green",
        )}
      >
        <Laptop className="size-5.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[17px] font-semibold">{device.name}</span>
        <span className="block truncate text-[13px] text-muted-foreground">{detail}</span>
      </span>
      <span
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold",
          !online ? "bg-fill text-muted-foreground" : paused ? "bg-ios-orange/15 text-ios-orange" : "bg-ios-green/15 text-ios-green",
        )}
      >
        <span
          className={cn(
            "size-1.5 rounded-full bg-current",
            online && !paused && "animate-pulse",
          )}
        />
        {state}
      </span>
    </Link>
  );
}
