// Called by the Mac companion's "Activate PAMI" menu item (X-Device-Token).
// Mirrors the web dashboard's direct RLS-permitted insert into tasks, so
// both surfaces create tasks through equivalent paths (per the project's
// unified-activation-pipeline requirement) — the difference is just which
// caller authenticates the write, not the shape of the resulting row.
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient, requireTrustedDevice } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();
  const device = await requireTrustedDevice(admin, req);
  if (!device) return jsonResponse({ error: "unauthorized" }, 401);

  let title = "Activate PAMI";
  let type = "manual_activation";
  let prompt: string | null = null;
  try {
    const body = await req.json();
    if (body?.title) title = String(body.title);
    if (body?.type) type = String(body.type);
    if (body?.prompt) prompt = String(body.prompt);
  } catch {
    // no body is fine — defaults above apply
  }

  const { data: task, error } = await admin
    .from("tasks")
    .insert({
      user_id: device.user_id,
      device_id: device.id,
      source: "mac",
      type,
      title,
      prompt,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return jsonResponse({ error: error.message }, 500);

  return jsonResponse({ ok: true, task_id: task.id });
});
