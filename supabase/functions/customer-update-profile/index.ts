import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const customerPhone = normalizePhone(String(body.customer_phone || ""));
    const sessionToken = String(body.session_token || "");
    const customerName = String(body.customer_name || "").trim();
    const customerCity = String(body.customer_city || "").trim();

    if (!customerPhone || !sessionToken || (!customerName && !customerCity)) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: session } = await supabase
      .from("customer_web_sessions")
      .select("customer_phone, expires_at")
      .eq("session_token", sessionToken)
      .maybeSingle();

    if (!session || session.customer_phone !== customerPhone || new Date(session.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (customerName) updates.customer_name = customerName;
    if (customerCity) updates.city = customerCity;

    const { error } = await supabase
      .from("customer_profiles")
      .update(updates)
      .eq("customer_phone", customerPhone);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, customer_name: customerName, customer_city: customerCity }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
