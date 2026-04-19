// Public endpoint — TV app calls this with the pairing code shown in the admin dashboard.
// On success, marks the device as paired, stores reported resolution, and returns the device id.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const code = String(body.code ?? "").trim().toUpperCase();
    const resolution = typeof body.resolution === "string" ? body.resolution : null;
    const userAgent = req.headers.get("user-agent") ?? null;

    if (!/^[A-Z0-9]{6}$/.test(code)) {
      return new Response(JSON.stringify({ error: "Invalid code format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: device, error: lookupErr } = await supabase
      .from("devices")
      .select("id, company_id, is_paired, name")
      .eq("pairing_code", code)
      .maybeSingle();

    if (lookupErr) throw lookupErr;
    if (!device) {
      return new Response(JSON.stringify({ error: "Code not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (device.is_paired) {
      return new Response(JSON.stringify({ error: "Code already used" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates: Record<string, unknown> = {
      is_paired: true,
      pairing_code: null,
      status: "online",
      last_seen_at: new Date().toISOString(),
    };
    if (resolution && /^\d{3,5}x\d{3,5}$/.test(resolution)) updates.resolution = resolution;

    const { error: updErr } = await supabase
      .from("devices")
      .update(updates)
      .eq("id", device.id);

    if (updErr) throw updErr;

    console.log(`Device ${device.id} (${device.name}) paired. UA=${userAgent}`);

    return new Response(JSON.stringify({
      device_id: device.id,
      company_id: device.company_id,
      name: device.name,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("claim-device-code error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
