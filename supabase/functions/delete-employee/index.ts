import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { employee_id } = await req.json();
    if (!employee_id) {
      return new Response(JSON.stringify({ error: "employee_id مطلوب" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user_id first
    const { data: emp, error: empError } = await supabaseAdmin
      .from("employees")
      .select("user_id")
      .eq("id", employee_id)
      .maybeSingle();
    if (empError) throw empError;
    if (!emp) throw new Error("الموظف غير موجود");

    // Delete from employees table
    const { error: delError } = await supabaseAdmin.from("employees").delete().eq("id", employee_id);
    if (delError) throw delError;

    // Delete auth user
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(emp.user_id);
    if (authError) throw authError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
