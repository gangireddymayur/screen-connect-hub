import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    // Client to verify the caller is a super_admin
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check super_admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: super_admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { name, contact_email, password, max_screens } = await req.json();

    if (!name || !contact_email || !password) {
      return new Response(JSON.stringify({ error: "name, contact_email, and password are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Create the company
    const { data: company, error: companyError } = await adminClient
      .from("companies")
      .insert({ name, contact_email, max_screens: max_screens || 10, created_by: caller.id })
      .select()
      .single();

    if (companyError) {
      return new Response(JSON.stringify({ error: companyError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Create the admin auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: contact_email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name + " Admin" },
    });

    if (authError) {
      // Rollback company
      await adminClient.from("companies").delete().eq("id", company.id);
      return new Response(JSON.stringify({ error: authError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminUserId = authData.user.id;

    // 3. Link profile to company
    await adminClient
      .from("profiles")
      .update({ company_id: company.id })
      .eq("id", adminUserId);

    // 4. Assign admin role
    const { error: roleError } = await adminClient
      .from("user_roles")
      .insert({ user_id: adminUserId, role: "admin" });

    if (roleError) {
      return new Response(JSON.stringify({ error: roleError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ company, admin_user_id: adminUserId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
