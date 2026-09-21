// Called by the Mac companion (X-Device-Token) to advance a task's status
// once it picks it up from a heartbeat response. This is the only way task
// status moves past 'pending' — the browser has no update policy on tasks.
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient, requireTrustedDevice } from "../_shared/supabaseAdmin.ts";

const ALLOWED_STATUSES = [
  "acknowledged",
  "in_progress",
  "waiting_for_approval",
  "completed",
  "failed",
  "cancelled",
];

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();
  const device = await requireTrustedDevice(admin, req);
  if (!device) return jsonResponse({ error: "unauthorized" }, 401);

  try {
    const { task_id, status, result } = await req.json();
    if (!task_id || !ALLOWED_STATUSES.includes(status)) {
      return jsonResponse({ error: "task_id and a valid status are required" }, 400);
    }

    const { data: task, error: findError } = await admin
      .from("tasks")
      .select("id, user_id")
      .eq("id", task_id)
      .maybeSingle();

    if (findError || !task || task.user_id !== device.user_id) {
      return jsonResponse({ error: "task not found" }, 404);
    }

    const { error: updateError } = await admin
      .from("tasks")
      .update({
        status,
        device_id: device.id,
        updated_at: new Date().toISOString(),
        result: typeof result === "string" ? result : undefined,
      })
      .eq("id", task_id);

    if (updateError) return jsonResponse({ error: updateError.message }, 500);

    await admin.from("task_events").insert({
      task_id,
      event_type: "status_changed",
      payload: { status, source: "mac" },
    });

    if (typeof result === "string") {
      await admin.from("task_logs").insert({
        task_id,
        level: "info",
        message: result,
      });
    }

    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: "invalid request body" }, 400);
  }
});
