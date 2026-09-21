"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { isPushSupported, urlBase64ToUint8Array } from "@/lib/push";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function PushSettingsForm({ userId }: { userId: string }) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPushSupported() || !VAPID_PUBLIC_KEY) return;
    setSupported(true);

    navigator.serviceWorker.register("/sw.js").then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();
      setEnabled(existing !== null);
    });
  }, []);

  async function handleChange(next: boolean) {
    setPending(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");

      if (next) {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          throw new Error("Notification permission was denied.");
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          // Cast needed: TS's DOM lib wants BufferSource backed specifically
          // by ArrayBuffer, but a typed array's inferred generic parameter
          // is the broader ArrayBufferLike (also covers SharedArrayBuffer)
          // — the runtime value is fine, this is purely a lib-typing gap.
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
        });

        const json = subscription.toJSON();
        const supabase = createClient();
        // upsert on endpoint: re-enabling after a prior subscribe (e.g. on
        // a different account) shouldn't collide with the unique constraint.
        const { error } = await supabase.from("push_subscriptions").upsert(
          {
            user_id: userId,
            endpoint: subscription.endpoint,
            p256dh: json.keys!.p256dh,
            auth: json.keys!.auth,
          },
          { onConflict: "endpoint" },
        );
        if (error) throw error;
        setEnabled(true);
      } else {
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          const supabase = createClient();
          await supabase.from("push_subscriptions").delete().eq("endpoint", existing.endpoint);
          await existing.unsubscribe();
        }
        setEnabled(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
    setPending(false);
  }

  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground">
        Push notifications aren&rsquo;t supported in this browser. On iPhone, add PAMI to your
        Home Screen first (Share → Add to Home Screen), then open it from there.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="push-notifications">Push notifications for approvals</Label>
          <p className="text-sm text-muted-foreground">
            Get notified on this device the moment PAMI needs your approval for something on the
            Mac.
          </p>
        </div>
        <Switch
          id="push-notifications"
          checked={enabled}
          disabled={pending}
          onCheckedChange={handleChange}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
