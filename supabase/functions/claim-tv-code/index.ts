// Authenticated — admin enters the code shown on a TV. We attach that orphan device row
// to the admin's company, set its name/location, and mark it paired.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims, error: authErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (authErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub;

    const body = await req.json().catch(() => ({}));
    const code = String(body.code ?? "").trim().toUpperCase();
    const name = String(body.name ?? "").trim();
    const location = body.location ? String(body.location).trim() : null;
    const orientation = body.orientation === "portrait" ? "portrait" : "landscape";

    if (!/^[A-Z0-9]{6}$/.test(code)) {
      return new Response(JSON.stringify({ error: "Invalid code format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!name) {
      return new Response(JSON.stringify({ error: "Device name is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find admin's company
    const { data: profile, error: pErr } = await admin
      .from("profiles").select("company_id").eq("id", userId).maybeSingle();
    if (pErr) throw pErr;
    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: "Your account is not linked to a company" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find orphan device with matching code
    const { data: device, error: dErr } = await admin
      .from("devices").select("id, is_paired, company_id")
      .eq("pairing_code", code).maybeSingle();
    if (dErr) throw dErr;
    if (!device) {
      return new Response(JSON.stringify({ error: "Code not found. Make sure your TV is showing this code." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (device.is_paired || device.company_id) {
      return new Response(JSON.stringify({ error: "This code has already been used" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: updated, error: updErr } = await admin.from("devices").update({
      company_id: profile.company_id,
      name, location, orientation,
      is_paired: true,
      pairing_code: null,
      status: "online",
      last_seen_at: new Date().toISOString(),
    }).eq("id", device.id).select("*").single();
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ device: updated }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("claim-tv-code:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
