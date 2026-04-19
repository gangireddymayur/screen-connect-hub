// Public endpoint — paired TV pings every ~30s to update last_seen_at and fetch its assigned layout.
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
    const deviceId = String(body.device_id ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(deviceId)) {
      return new Response(JSON.stringify({ error: "Invalid device_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: device, error } = await supabase
      .from("devices")
      .update({ last_seen_at: new Date().toISOString(), status: "online" })
      .eq("id", deviceId)
      .eq("is_paired", true)
      .select("id, name, layout_id, orientation, resolution")
      .maybeSingle();

    if (error) throw error;
    if (!device) {
      return new Response(JSON.stringify({ error: "Device not found or unpaired" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let layout = null;
    if (device.layout_id) {
      const { data: l } = await supabase
        .from("layouts")
        .select("id, name, layout_data, background_color, resolution_width, resolution_height")
        .eq("id", device.layout_id)
        .maybeSingle();
      layout = l;
    }

    return new Response(JSON.stringify({ device, layout }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("device-heartbeat error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
