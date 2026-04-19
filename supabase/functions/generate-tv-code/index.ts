// Public — TV calls this on load to create an orphan device row with a pairing code.
// Returns the code + a temporary device_id the TV uses to poll status.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const generateCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let c = "";
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const resolution = typeof body.resolution === "string" && /^\d{3,5}x\d{3,5}$/.test(body.resolution)
      ? body.resolution : "1920x1080";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Try a few times to avoid code collision
    let code = "";
    let inserted = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      code = generateCode();
      const { data, error } = await supabase.from("devices").insert({
        name: "Pending TV",
        company_id: null,
        pairing_code: code,
        is_paired: false,
        status: "offline",
        resolution,
        last_seen_at: new Date().toISOString(),
      }).select("id").single();
      if (!error && data) { inserted = data; break; }
      if (error && !error.message.includes("duplicate")) throw error;
    }
    if (!inserted) throw new Error("Could not generate unique code");

    return new Response(JSON.stringify({ code, device_id: inserted.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-tv-code:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
