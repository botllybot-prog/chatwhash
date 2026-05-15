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

function randomToken() {
  return `${crypto.randomUUID()}-${crypto.randomUUID()}`;
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const customerPhone = normalizePhone(String(body.customer_phone || "").trim());
    const code = String(body.code || "").trim();

    if (!customerPhone || !code) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: row } = await supabase
      .from("customer_login_codes")
      .select("id, code, expires_at, attempts, verified_at")
      .eq("customer_phone", customerPhone)
      .is("verified_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) {
      return new Response(JSON.stringify({ error: "No active code found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "Code expired" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (Number(row.attempts || 0) >= 5) {
      return new Response(JSON.stringify({ error: "Too many attempts" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (String(row.code) !== code) {
      await supabase
        .from("customer_login_codes")
        .update({ attempts: Number(row.attempts || 0) + 1 })
        .eq("id", row.id);
      return new Response(JSON.stringify({ error: "Invalid code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("customer_login_codes")
      .update({ verified_at: new Date().toISOString(), attempts: Number(row.attempts || 0) + 1 })
      .eq("id", row.id);

    const { data: profile } = await supabase
      .from("customer_profiles")
      .select("customer_name")
      .eq("customer_phone", customerPhone)
      .maybeSingle();

    const token = randomToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const customerName = profile?.customer_name || "Customer";

    await supabase.from("customer_web_sessions").insert({
      customer_phone: customerPhone,
      customer_name: customerName,
      session_token: token,
      expires_at: expiresAt,
    });

    return new Response(
      JSON.stringify({
        success: true,
        session_token: token,
        expires_at: expiresAt,
        customer_phone: customerPhone,
        customer_name: customerName,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
