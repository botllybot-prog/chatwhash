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

async function sendWhatsAppText(
  phone: string,
  bodyText: string,
  accessToken: string,
  phoneNumberId: string,
) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: bodyText },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`WhatsApp API error: ${res.status} ${JSON.stringify(data)}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const isInternalServiceCall = token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!isInternalServiceCall) {
      const {
        data: { user: caller },
      } = await supabaseAdmin.auth.getUser(token);

      if (!caller) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: roleData } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id)
        .maybeSingle();

      if (!roleData || !["admin", "employee"].includes(roleData.role)) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { owner_id } = await req.json();
    if (!owner_id) {
      return new Response(JSON.stringify({ error: "Missing owner_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: owner } = await supabaseAdmin
      .from("station_owners")
      .select("id, owner_name, owner_phone, stations(name)")
      .eq("id", owner_id)
      .maybeSingle();

    if (!owner?.owner_phone) {
      return new Response(JSON.stringify({ message: "Owner not found or no phone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settingsRows } = await supabaseAdmin.from("app_settings").select("key, value");
    const settings: Record<string, string> = {};
    if (settingsRows) {
      for (const row of settingsRows as { key: string; value: string }[]) {
        settings[row.key] = row.value;
      }
    }

    const accessToken = settings.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = settings.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      return new Response(JSON.stringify({ error: "WhatsApp API not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stationName = (owner.stations as { name?: string } | null)?.name || "محطتك";
    const message =
      `⚠️ إشعار إداري مهم\n\n` +
      `تم إيقاف حساب محطة ${stationName} مؤقتاً من قبل الإدارة.\n` +
      `هذا الإيقاف إداري وليس متعلقاً بالدفع أو الاشتراك.\n` +
      `يرجى التواصل مع الشركة مباشرة لمعرفة السبب وإعادة التفعيل.\n\n` +
      `شكراً لتفهمك.`;

    await sendWhatsAppText(
      normalizePhone(owner.owner_phone),
      message,
      accessToken,
      phoneNumberId,
    );

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("send-suspension-notice error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unexpected error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
