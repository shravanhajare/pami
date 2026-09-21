// Called by the web dashboard (supabase.functions.invoke, carries the user's
// real Supabase Auth access token) when the user enters a pairing code shown
// on the Mac. Flips the matching pending device row to trusted.
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const authHeader = req.headers.get("authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return jsonResponse({ error: "missing authorization" }, 401);

  const admin = createAdminClient();
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData.user) {
    return jsonResponse({ error: "invalid session" }, 401);
  }

  try {
    const { pairing_code } = await req.json();
    if (!pairing_code) return jsonResponse({ error: "pairing_code is required" }, 400);

    const normalized = String(pairing_code).trim().toUpperCase();

    const { data: device, error: findError } = await admin
      .from("devices")
      .select("id, pairing_expires_at, status")
      .eq("pairing_code", normalized)
      .maybeSingle();

    if (findError || !device) {
      return jsonResponse({ error: "invalid pairing code" }, 404);
    }
    if (device.status !== "pending") {
      return jsonResponse({ error: "pairing code already used" }, 409);
    }
    if (!device.pairing_expires_at || new Date(device.pairing_expires_at) < new Date()) {
      return jsonResponse({ error: "pairing code expired" }, 410);
    }

    const { error: updateError } = await admin
      .from("devices")
      .update({
        user_id: userData.user.id,
        status: "trusted",
        paired_at: new Date().toISOString(),
        pairing_code: null,
        pairing_expires_at: null,
      })
      .eq("id", device.id);

    if (updateError) return jsonResponse({ error: updateError.message }, 500);

    return jsonResponse({ ok: true, device_id: device.id });
  } catch {
    return jsonResponse({ error: "invalid request body" }, 400);
  }
});
