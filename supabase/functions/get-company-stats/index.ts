import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles").select("role").eq("user_id", caller.id).eq("role", "super_admin").single();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { company_id } = await req.json();
    if (!company_id) {
      return new Response(JSON.stringify({ error: "company_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const [devicesRes, contentRes, layoutsRes, schedulesRes, profileRes] = await Promise.all([
      adminClient.from("devices").select("id, is_paired, last_seen_at", { count: "exact" }).eq("company_id", company_id),
      adminClient.from("content").select("id", { count: "exact" }).eq("company_id", company_id),
      adminClient.from("layouts").select("id", { count: "exact" }).eq("company_id", company_id),
      adminClient.from("schedules").select("id, is_active", { count: "exact" }).eq("company_id", company_id),
      adminClient.from("profiles").select("id").eq("company_id", company_id).limit(1).single(),
    ]);

    const devices = devicesRes.data ?? [];
    const pairedDevices = devices.filter((d: any) => d.is_paired).length;
    const lastDeviceActivity = devices
      .map((d: any) => d.last_seen_at)
      .filter(Boolean)
      .sort()
      .pop() ?? null;
    const activeSchedules = (schedulesRes.data ?? []).filter((s: any) => s.is_active).length;

    let lastSignInAt: string | null = null;
    let adminEmail: string | null = null;
    if (profileRes.data?.id) {
      const { data: userData } = await adminClient.auth.admin.getUserById(profileRes.data.id);
      lastSignInAt = userData?.user?.last_sign_in_at ?? null;
      adminEmail = userData?.user?.email ?? null;
    }

    return new Response(
      JSON.stringify({
        devices_total: devicesRes.count ?? 0,
        devices_paired: pairedDevices,
        content_total: contentRes.count ?? 0,
        layouts_total: layoutsRes.count ?? 0,
        schedules_total: schedulesRes.count ?? 0,
        schedules_active: activeSchedules,
        last_device_activity: lastDeviceActivity,
        admin_last_sign_in: lastSignInAt,
        admin_email: adminEmail,
        admin_id: profileRes.data?.id ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
