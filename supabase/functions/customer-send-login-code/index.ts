import { createClient } from "npm:@supabase/supabase-js@2";
import { loadAppSettings } from "../_shared/request-packages.ts";
import { sendWhatsAppTextReliable } from "../_shared/whatsapp-reliable.ts";

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

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
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
    const customerName = String(body.customer_name || "").trim();
    const customerPhone = normalizePhone(String(body.customer_phone || "").trim());

    if (!customerName || !customerPhone) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabase.from("customer_profiles").upsert(
      {
        customer_phone: customerPhone,
        customer_name: customerName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "customer_phone" },
    );

    await supabase.from("customer_login_codes").insert({
      customer_phone: customerPhone,
      code,
      expires_at: expiresAt,
      attempts: 0,
    });

    const settings = await loadAppSettings(supabase);
    const msg =
      `رمز تسجيل الدخول إلى Washlly: ${code}\n` +
      `ينتهي خلال 10 دقائق.\n` +
      `لا تشارك هذا الرمز مع أي شخص.`;
    const wa = await sendWhatsAppTextReliable({ phone: customerPhone, message: msg, settings, language: "ar" });
    if (!wa.ok) {
      return new Response(JSON.stringify({ error: "Failed to send WhatsApp code" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, expires_at: expiresAt }), {
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
