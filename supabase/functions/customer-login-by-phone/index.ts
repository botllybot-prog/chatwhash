import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string) {
  const western = phone
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));
  const cleaned = western.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned;
}

function randomToken() {
  return `${crypto.randomUUID()}-${crypto.randomUUID()}`;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const customerPhone = normalizePhone(String(body.customer_phone || "").trim());
    const submittedName = String(body.customer_name || "").trim();
    const submittedCity = String(body.customer_city || "").trim();

    if (!customerPhone) return json({ error: "Missing customer phone" }, 400);

    const { data: profile, error: profileError } = await supabase
      .from("customer_profiles")
      .select("customer_name, city, is_blocked")
      .eq("customer_phone", customerPhone)
      .maybeSingle();

    if (profileError) return json({ error: profileError.message }, 500);

    if (profile?.is_blocked) {
      return json({ error: "Customer account is blocked" }, 403);
    }

    const savedName = String(profile?.customer_name || "").trim();
    const customerName = submittedName || savedName;

    if (!customerName) {
      return json({
        success: true,
        requires_name: true,
        customer_phone: customerPhone,
      });
    }

    const savedCity = String(profile?.city || "").trim();
    const customerCity = submittedCity || savedCity;

    if (!customerCity) {
      return json({
        success: true,
        requires_city: true,
        customer_phone: customerPhone,
        customer_name: customerName,
      });
    }

    const { error: profileSaveError } = await supabase.from("customer_profiles").upsert(
      {
        customer_phone: customerPhone,
        customer_name: customerName,
        city: customerCity,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "customer_phone" },
    );

    if (profileSaveError) return json({ error: profileSaveError.message }, 500);

    const token = randomToken();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const { error: sessionError } = await supabase.from("customer_web_sessions").insert({
      customer_phone: customerPhone,
      customer_name: customerName,
      session_token: token,
      expires_at: expiresAt,
    });

    if (sessionError) return json({ error: sessionError.message }, 500);

    return json({
      success: true,
      requires_verification: false,
      requires_name: false,
      session_token: token,
      expires_at: expiresAt,
      customer_phone: customerPhone,
      customer_name: customerName,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
