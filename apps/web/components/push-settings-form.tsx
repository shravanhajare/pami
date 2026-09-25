"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Switch } from "@/components/ui/switch";
import { IconBadge, ListRow } from "@/components/ui/list";
import { isPushSupported, urlBase64ToUint8Array } from "@/lib/push";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

const noopSubscribe = () => () => {};

export function PushSettingsForm({ userId }: { userId: string }) {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => isPushSupported() && !!VAPID_PUBLIC_KEY,
    () => false,
  );
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;

    navigator.serviceWorker.register("/sw.js").then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();
      setEnabled(existing !== null);
    });
  }, [supported]);

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

  return (
    <>
      <ListRow
        icon={<IconBadge icon={Bell} className="bg-ios-red" />}
        title={<label htmlFor="push-notifications">Approval Alerts</label>}
        subtitle={
          supported
            ? undefined
            : "Not available in this browser. On iPhone, add PAMI to your Home Screen (Share → Add to Home Screen) and open it from there."
        }
        detail={
          <Switch
            id="push-notifications"
            checked={enabled}
            disabled={!supported || pending}
            onCheckedChange={handleChange}
          />
        }
      />
      {error && <ListRow title={<span className="text-[15px] text-destructive">{error}</span>} />}
    </>
  );
}
