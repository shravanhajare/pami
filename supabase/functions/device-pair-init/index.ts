// Called by the Mac companion on first launch (anon key only, no device
// token yet — none exists). Creates a pending device row and returns a
// pairing code (shown in the menu bar) plus a device token (stored in
// Keychain immediately, but inert until a user confirms pairing on /mac).
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabaseAdmin.ts";
import { randomDeviceToken, randomPairingCode, sha256Hex } from "../_shared/crypto.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { device_id, name, os_version } = await req.json();
    if (!device_id || !name) {
      return jsonResponse({ error: "device_id and name are required" }, 400);
    }

    const admin = createAdminClient();
    const token = randomDeviceToken();
    const tokenHash = await sha256Hex(token);
    const pairingCode = randomPairingCode();

    const { error } = await admin.from("devices").insert({
      id: device_id,
      name,
      platform: "macos",
      os_version: os_version ?? null,
      token_hash: tokenHash,
      pairing_code: pairingCode,
      pairing_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      status: "pending",
      state: "offline",
    });

    if (error) {
      // Most likely cause: this device_id already has a row (re-running
      // pair-init after a partial failure). Let the Mac retry with a new
      // device_id rather than trying to be clever about upserts here.
      return jsonResponse({ error: error.message }, 409);
    }

    return jsonResponse({ pairing_code: pairingCode, device_token: token });
  } catch {
    return jsonResponse({ error: "invalid request body" }, 400);
  }
});
