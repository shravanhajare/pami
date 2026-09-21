// Edge Functions here are only ever called by the Next.js dashboard (browser,
// via supabase-js) or the Mac companion (native HTTP client, no browser CORS
// preflight involved) — a permissive CORS policy is fine since every function
// separately authenticates the caller (user JWT or X-Device-Token).
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-device-token",
};

export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
