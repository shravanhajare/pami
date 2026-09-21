// Called by the Mac companion (X-Device-Token) when a task needs a
// destructive or unclassified action approved before running (e.g. a shell
// command that isn't on the read-only allowlist — see SystemTools.swift).
// Moves the task to waiting_for_approval and creates the approvals row the
// dashboard's Approve/Deny buttons act on.
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient, requireTrustedDevice } from "../_shared/supabaseAdmin.ts";
import { sendPushToUser } from "../_shared/webpush.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();
  const device = await requireTrustedDevice(admin, req);
  if (!device) return jsonResponse({ error: "unauthorized" }, 401);

  try {
    const { task_id, requested_action } = await req.json();
    if (!task_id || !requested_action) {
      return jsonResponse({ error: "task_id and requested_action are required" }, 400);
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
      .update({ status: "waiting_for_approval", updated_at: new Date().toISOString() })
      .eq("id", task_id);
    if (updateError) return jsonResponse({ error: updateError.message }, 500);

    const { data: approval, error: approvalError } = await admin
      .from("approvals")
      .insert({
        task_id,
        user_id: device.user_id,
        status: "pending",
        requested_action,
      })
      .select("id")
      .single();
    if (approvalError) return jsonResponse({ error: approvalError.message }, 500);

    await admin.from("task_events").insert({
      task_id,
      event_type: "approval_requested",
      payload: { requested_action },
    });

    const command =
      requested_action && typeof requested_action === "object" && "command" in requested_action
        ? String((requested_action as { command: unknown }).command)
        : "a command";
    // Best-effort — sendPushToUser never throws, so a push failure (or no
    // subscriptions at all) can't turn a successful approval request into
    // an error response.
    await sendPushToUser(admin, device.user_id, {
      title: "PAMI needs your approval",
      body: command,
      url: "/dashboard",
    });

    return jsonResponse({ ok: true, approval_id: approval.id });
  } catch {
    return jsonResponse({ error: "invalid request body" }, 400);
  }
});
