// Sends a Web Push notification to every device a user has subscribed from
// (see push_subscriptions table / apps/web/components/push-settings-form.tsx).
// Needs three secrets set on this project (`supabase secrets set` or the
// Dashboard): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// (a mailto: address). Deliberately fails soft everywhere — a missing
// secret or a dead subscription should never block the actual approval
// request it's attached to.
import webpush from "npm:web-push@3.6.7";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT");
  if (!publicKey || !privateKey || !subject) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export async function sendPushToUser(
  admin: SupabaseClient,
  userId: string,
  payload: { title: string; body: string; url?: string },
): Promise<void> {
  if (!ensureVapid()) {
    console.warn("Push notification skipped: VAPID secrets not configured.");
    return;
  }

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs || subs.length === 0) return;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
      } catch (err) {
        // 404/410 means the browser dropped the subscription (uninstalled,
        // permission revoked, etc.) — clean it up so we stop trying it.
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("Push notification failed:", err);
        }
      }
    }),
  );
}
