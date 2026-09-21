// Called by the Mac companion on every poll cycle (~2s while pairing is
// pending, ~20s once trusted). Looks the device up by token regardless of
// status so the Mac can detect the pending -> trusted flip; only does
// session/heartbeat bookkeeping and returns pending tasks once trusted.
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabaseAdmin.ts";
import { randomPairingCode, sha256Hex } from "../_shared/crypto.ts";

const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const token = req.headers.get("x-device-token");
  if (!token) return jsonResponse({ error: "missing X-Device-Token" }, 401);

  const admin = createAdminClient();
  const tokenHash = await sha256Hex(token);

  const { data: device, error: findError } = await admin
    .from("devices")
    .select("id, user_id, status, state, pairing_code, pairing_expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (findError || !device) return jsonResponse({ error: "unknown device" }, 401);
  if (device.status === "revoked") return jsonResponse({ error: "device revoked" }, 403);

  if (device.status === "pending") {
    // Pairing codes expire (5 min from device-pair-init), but the Mac keeps
    // polling with the same device token indefinitely — self-heal by
    // minting a fresh code here instead of leaving the device stuck with a
    // dead code the user can never redeem.
    const isExpired =
      !device.pairing_expires_at || new Date(device.pairing_expires_at) < new Date();

    let pairingCode = device.pairing_code;
    if (isExpired) {
      pairingCode = randomPairingCode();
      await admin
        .from("devices")
        .update({
          pairing_code: pairingCode,
          pairing_expires_at: new Date(Date.now() + PAIRING_CODE_TTL_MS).toISOString(),
        })
        .eq("id", device.id);
    }

    return jsonResponse({ status: "pending", pairing_code: pairingCode, tasks: [] });
  }

  let body: { agent_version?: string; os_version?: string; state?: string } = {};
  try {
    body = await req.json();
  } catch {
    // heartbeats may be sent with an empty body; that's fine
  }

  const now = new Date().toISOString();
  await admin
    .from("devices")
    .update({
      last_seen_at: now,
      agent_version: body.agent_version ?? undefined,
      os_version: body.os_version ?? undefined,
      state: body.state ?? undefined,
    })
    .eq("id", device.id);

  const { data: openSession } = await admin
    .from("device_sessions")
    .select("id")
    .eq("device_id", device.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openSession) {
    await admin
      .from("device_sessions")
      .update({ last_heartbeat_at: now })
      .eq("id", openSession.id);
  } else {
    await admin.from("device_sessions").insert({
      device_id: device.id,
      agent_version: body.agent_version ?? null,
      os_version: body.os_version ?? null,
    });
  }

  // Tasks aren't necessarily targeted at a specific device_id (e.g. one
  // created from the web dashboard) — any pending task belonging to this
  // device's user is fair game, since there's a single trusted Mac per user
  // in M1/M2.
  const { data: pendingTasks } = await admin
    .from("tasks")
    .select("id, title, type, status, source, prompt")
    .eq("user_id", device.user_id)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  // Tasks waiting on a dashboard Approve/Deny decision — only surface ones
  // whose approval has actually been resolved, so the Mac can finish (or
  // cancel) them. Still-pending approvals are silently skipped each cycle.
  const { data: waitingTasks } = await admin
    .from("tasks")
    .select("id, title, type, status, source, prompt, approvals(status, requested_action)")
    .eq("user_id", device.user_id)
    .eq("status", "waiting_for_approval");

  const resolvedTasks = (waitingTasks ?? [])
    .map((t) => {
      const approval = Array.isArray(t.approvals) ? t.approvals[0] : t.approvals;
      if (!approval || approval.status === "pending") return null;
      return {
        id: t.id,
        title: t.title,
        type: t.type,
        status: t.status,
        source: t.source,
        prompt: t.prompt,
        approval_decision: approval.status,
        requested_action: approval.requested_action,
      };
    })
    .filter((t) => t !== null);

  return jsonResponse({ status: "trusted", tasks: [...(pendingTasks ?? []), ...resolvedTasks] });
});
