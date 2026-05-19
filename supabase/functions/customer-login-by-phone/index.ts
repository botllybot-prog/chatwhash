import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string) {
  const western = phone
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
  const cleaned = western.replace(/[^\d+]/g, "").replace(/^\+/, "");
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
    const customerPhone = normalizePhone(String(body.customer_phone || ""));
    if (!customerPhone) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("customer_profiles")
      .select("customer_name, is_blocked")
      .eq("customer_phone", customerPhone)
      .maybeSingle();

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (profile?.is_blocked) {
      return new Response(JSON.stringify({ error: "Customer account is blocked" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let wasVerifiedBefore = false;
    if (profile?.customer_name) {
      const { data: existingSession } = await supabase
        .from("customer_web_sessions")
        .select("id")
        .eq("customer_phone", customerPhone)
        .limit(1)
        .maybeSingle();

      if (existingSession) {
        wasVerifiedBefore = true;
      } else {
        const { data: verifiedCode } = await supabase
          .from("customer_login_codes")
          .select("id")
          .eq("customer_phone", customerPhone)
          .not("verified_at", "is", null)
          .limit(1)
          .maybeSingle();
        wasVerifiedBefore = Boolean(verifiedCode);
      }
    }

    if (profile?.customer_name && wasVerifiedBefore) {
      const token = randomToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await supabase.from("customer_web_sessions").insert({
        customer_phone: customerPhone,
        customer_name: profile.customer_name,
        session_token: token,
        expires_at: expiresAt,
      });

      return new Response(
        JSON.stringify({
          success: true,
          requires_verification: false,
          requires_name: false,
          session_token: token,
          expires_at: expiresAt,
          customer_phone: customerPhone,
          customer_name: profile.customer_name,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        requires_verification: true,
        requires_name: !profile?.customer_name,
        customer_phone: customerPhone,
        customer_name: profile?.customer_name || "",
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
