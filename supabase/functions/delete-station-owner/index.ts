import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Verify caller is admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", caller.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { owner_id } = await req.json();
    if (!owner_id) {
      return new Response(JSON.stringify({ error: "Missing owner_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get owner's user_id
    const { data: owner } = await supabaseAdmin.from("station_owners").select("user_id").eq("id", owner_id).maybeSingle();
    if (!owner) {
      return new Response(JSON.stringify({ error: "Owner not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = owner.user_id;

    // Delete station_owners record
    await supabaseAdmin.from("station_owners").delete().eq("id", owner_id);

    // Delete user_roles
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);

    // Delete notifications
    await supabaseAdmin.from("notifications").delete().eq("user_id", userId);

    // Delete auth user
    await supabaseAdmin.auth.admin.deleteUser(userId);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
