"use client";

import Link from "next/link";
import { ChevronRight, WifiOff } from "lucide-react";
import { useDevicesRealtime } from "@/hooks/use-devices-realtime";
import type { Database } from "@/lib/supabase/database.types";

type Device = Database["public"]["Tables"]["devices"]["Row"];

// Above the conversation: says up front when nothing will answer, instead
// of leaving a request on "Sent to your Mac…" with no explanation.
export function MacOfflineBanner({ userId, initialDevices }: { userId: string; initialDevices: Device[] }) {
  const devices = useDevicesRealtime(userId, initialDevices).filter((d) => d.status === "trusted");
  if (devices.some((d) => d.isOnline)) return null;

  return (
    <Link
      href="/mac"
      className="pressable mb-4 flex items-center gap-3 rounded-2xl bg-ios-orange/15 px-4 py-3"
    >
      <WifiOff className="size-5 shrink-0 text-ios-orange" />
      <span className="min-w-0 flex-1 text-[15px] leading-snug">
        {devices.length === 0 ? (
          <>
            <span className="font-semibold">No Mac paired.</span>{" "}
            <span className="text-muted-foreground">Pair one to start sending requests.</span>
          </>
        ) : (
          <>
            <span className="font-semibold">Your Mac is offline.</span>{" "}
            <span className="text-muted-foreground">Requests will wait until it reconnects.</span>
          </>
        )}
      </span>
      <ChevronRight className="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
    </Link>
  );
}
