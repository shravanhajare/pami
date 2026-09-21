import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { sha256Hex } from "./crypto.ts";

// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically into
// every Edge Function's environment — never set manually, never committed.
export function createAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export interface AuthedDevice {
  id: string;
  user_id: string;
  status: string;
  state: string;
}

// Looks up the device presenting X-Device-Token, requiring status='trusted'.
// Returns null (caller should 401) if the token is missing, unknown, or the
// device has been revoked.
export async function requireTrustedDevice(
  admin: SupabaseClient,
  req: Request,
): Promise<AuthedDevice | null> {
  const token = req.headers.get("x-device-token");
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const { data, error } = await admin
    .from("devices")
    .select("id, user_id, status, state")
    .eq("token_hash", tokenHash)
    .eq("status", "trusted")
    .maybeSingle();

  if (error || !data) return null;
  return data as AuthedDevice;
}
