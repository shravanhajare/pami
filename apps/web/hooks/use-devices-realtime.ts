"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type Device = Database["public"]["Tables"]["devices"]["Row"];

const STALE_AFTER_MS = 45_000;

export interface DeviceWithOnline extends Device {
  isOnline: boolean;
}

function withOnline(device: Device): DeviceWithOnline {
  const isOnline =
    device.status === "trusted" &&
    !!device.last_seen_at &&
    Date.now() - new Date(device.last_seen_at).getTime() < STALE_AFTER_MS;
  return { ...device, isOnline };
}

// Subscribes to Realtime changes on `devices` for the current user, and
// separately re-derives online/offline every few seconds from last_seen_at.
// Realtime only fires on row *changes* — a dead Mac agent produces no new
// events, so without this timer a crashed agent would look "online" forever.
export function useDevicesRealtime(userId: string, initial: Device[]) {
  const [devices, setDevices] = useState<DeviceWithOnline[]>(
    initial.map(withOnline),
  );

  useEffect(() => {
    setDevices(initial.map(withOnline));
  }, [initial]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("devices-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "devices",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setDevices((prev) => {
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as Partial<Device>;
              return prev.filter((d) => d.id !== oldRow.id);
            }
            const row = withOnline(payload.new as Device);
            const exists = prev.some((d) => d.id === row.id);
            return exists
              ? prev.map((d) => (d.id === row.id ? row : d))
              : [...prev, row];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDevices((prev) => prev.map(withOnline));
    }, 5_000);
    return () => clearInterval(interval);
  }, []);

  return devices;
}
