"use client";

import { useState } from "react";
import { Laptop } from "lucide-react";
import { cn } from "cn";
import { createClient } from "@/lib/supabase/client";
import { ListButtonRow, ListRow, ListSection } from "@/components/ui/list";
import { useHydrated } from "@/hooks/use-hydrated";
import type { DeviceWithOnline } from "@/hooks/use-devices-realtime";
import { formatRelativeTime } from "@/lib/format-task";

export function DeviceCard({ device }: { device: DeviceWithOnline }) {
  const [revoking, setRevoking] = useState(false);
  const hydrated = useHydrated();

  async function handleRevoke() {
    if (!confirm(`Revoke access for "${device.name}"? It will need to be paired again.`)) return;
    setRevoking(true);
    const supabase = createClient();
    // Permitted by the narrow RLS policy: users may only move status to
    // 'revoked', nothing else, directly from the browser.
    await supabase
      .from("devices")
      .update({ status: "revoked" })
      .eq("id", device.id);
    setRevoking(false);
  }

  const paused = device.isOnline && device.state === "paused";
  const statusLabel =
    device.status === "revoked"
      ? "Revoked"
      : paused
        ? "Paused"
        : device.isOnline
          ? "Online"
          : "Offline";
  const statusColor =
    device.status === "revoked"
      ? "text-destructive"
      : paused
        ? "text-ios-orange"
        : device.isOnline
          ? "text-ios-green"
          : "text-muted-foreground";

  return (
    <ListSection>
      <div className="flex items-center gap-3.5 px-4 py-3.5">
        <span
          className={cn(
            "flex size-14 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-b from-[#8e8e93] to-[#48484a] text-white",
            device.isOnline && !paused && "from-ios-blue to-ios-indigo",
          )}
        >
          <Laptop className="size-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[20px] leading-tight font-semibold">{device.name}</p>
          <p className={cn("mt-0.5 flex items-center gap-1.5 text-[15px] font-medium", statusColor)}>
            <span className={cn("size-2 rounded-full bg-current", device.isOnline && !paused && "animate-pulse")} />
            {statusLabel}
          </p>
        </div>
      </div>
      {device.os_version && <ListRow title="macOS" detail={device.os_version} />}
      {device.agent_version && <ListRow title="PAMI Agent" detail={device.agent_version} />}
      <ListRow
        title="Last Seen"
        detail={
          !device.last_seen_at
            ? "Never"
            : device.isOnline
              ? "Now"
              : hydrated
                ? formatRelativeTime(device.last_seen_at)
                : ""
        }
      />
      {device.paired_at && (
        <ListRow
          title="Paired"
          detail={hydrated ? new Date(device.paired_at).toLocaleDateString(undefined, { dateStyle: "medium" }) : ""}
        />
      )}
      {device.status !== "revoked" && (
        <ListButtonRow
          destructive
          title={revoking ? "Revoking…" : "Revoke Access"}
          onClick={handleRevoke}
          disabled={revoking}
        />
      )}
    </ListSection>
  );
}
