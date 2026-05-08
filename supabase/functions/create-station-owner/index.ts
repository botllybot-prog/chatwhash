import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the caller is an admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check admin or employee role
    const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", caller.id).maybeSingle();
    if (!roleData || !["admin", "employee"].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // If employee, verify they have can_create_owners permission
    if (roleData.role === "employee") {
      const { data: empData } = await supabaseAdmin.from("employees").select("can_create_owners").eq("user_id", caller.id).maybeSingle();
      if (!empData?.can_create_owners) {
        return new Response(JSON.stringify({ error: "لا تملك صلاحية إنشاء الحسابات" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { email, password, owner_name, owner_phone, station_id } = await req.json();

    if (!email || !password || !owner_name || !station_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create user
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = newUser.user.id;

    // Assign station_owner role
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "station_owner" });

    // Create station_owners record
    await supabaseAdmin.from("station_owners").insert({
      user_id: userId,
      station_id,
      owner_name,
      owner_phone: owner_phone || null,
      free_requests_quota: 20,
      free_requests_used: 0,
      created_by: caller.id,
    });

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
