// Public — TV polls every few seconds with its temporary device_id to check if claimed.
// Once claimed, also returns layout info for playback. Updates last_seen_at.
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

    // Update last_seen_at and read current state
    const { data: device, error } = await supabase.from("devices")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", deviceId)
      .select("id, name, is_paired, layout_id, orientation, resolution")
      .maybeSingle();
    if (error) throw error;
    if (!device) {
      return new Response(JSON.stringify({ error: "Device not found", reset: true }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let layout = null;
    if (device.is_paired && device.layout_id) {
      const { data: l } = await supabase.from("layouts")
        .select("id, name, layout_data, background_color, resolution_width, resolution_height")
        .eq("id", device.layout_id).maybeSingle();
      layout = l;
    }

    return new Response(JSON.stringify({ device, layout }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("tv-poll-status:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
