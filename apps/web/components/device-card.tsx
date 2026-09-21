"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DeviceWithOnline } from "@/hooks/use-devices-realtime";

export function DeviceCard({ device }: { device: DeviceWithOnline }) {
  const [revoking, setRevoking] = useState(false);

  async function handleRevoke() {
    if (!confirm(`Revoke access for "${device.name}"?`)) return;
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

  const statusLabel =
    device.status === "revoked"
      ? "Revoked"
      : device.isOnline
        ? "Online"
        : "Offline";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-base">{device.name}</CardTitle>
        <Badge variant={device.isOnline ? "default" : "secondary"}>
          {statusLabel}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p>Platform: {device.platform}</p>
        {device.os_version && <p>macOS: {device.os_version}</p>}
        {device.agent_version && <p>Agent version: {device.agent_version}</p>}
        <p>
          Last seen:{" "}
          {device.last_seen_at
            ? new Date(device.last_seen_at).toLocaleString()
            : "never"}
        </p>
        {device.status !== "revoked" && (
          <Button
            variant="destructive"
            size="sm"
            className="mt-2 w-fit"
            onClick={handleRevoke}
            disabled={revoking}
          >
            {revoking ? "Revoking…" : "Revoke"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
