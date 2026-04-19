import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendWhatsAppInteractive(
  phone: string,
  bodyText: string,
  buttons: { id: string; title: string }[],
  accessToken: string,
  phoneNumberId: string
): Promise<string | null> {
  const payload = {
    messaging_product: "whatsapp",
    to: phone,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: buttons.map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title.substring(0, 20) },
        })),
      },
    },
  };
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`WhatsApp API error: ${res.status} ${JSON.stringify(data)}`);
  }
  return data?.messages?.[0]?.id || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth: verify JWT and require admin role
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleData } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", caller.id).maybeSingle();
    if (!roleData || !["admin", "employee"].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = supabaseAdmin;

    const { owner_id } = await req.json();
    if (!owner_id) {
      return new Response(JSON.stringify({ error: "Missing owner_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch owner data
    const { data: owner } = await supabase
      .from("station_owners")
      .select("id, owner_name, owner_phone, outstanding_debt, stations(name)")
      .eq("id", owner_id)
      .maybeSingle();

    if (!owner?.owner_phone) {
      return new Response(JSON.stringify({ message: "Owner not found or no phone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch WhatsApp settings
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key, value");
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

    const debt = (owner.outstanding_debt as number) || 0;
    const stationName = (owner.stations as any)?.name || "مغسلتك";
    const suspendMsg =
      `⚠️ إشعار إداري مهم ⚠️\n\n` +
      `عذراً، تم إيقاف حساب ${stationName} في النظام.\n` +
      `السبب: وجود ذمة مالية غير مسددة.\n` +
      `المبلغ المستحق: ${debt.toLocaleString("ar-IQ")} دينار عراقي.\n\n` +
      `يرجى تسديد المبلغ للإدارة لإعادة تفعيل حسابك واستقبال الحجوزات.\n\n` +
      `اختر طريقة الدفع:`;

    // Normalize phone (ensure international format 964XXXXXXXXX)
    let phone = owner.owner_phone as string;
    if (/^07\d{9}$/.test(phone)) phone = "964" + phone.substring(1);

    const waId = await sendWhatsAppInteractive(
      phone,
      suspendMsg,
      [
        { id: "pay_method_zain", title: "💚 زين كاش" },
        { id: "pay_method_super", title: "🔵 سوبر كي" },
        { id: "pay_method_nas", title: "🟠 ناس وولت" },
      ],
      accessToken,
      phoneNumberId
    );
    if (!waId) {
      return new Response(JSON.stringify({ error: "Failed to send suspension notice" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update bot session so owner is ready for payment method selection
    await supabase
      .from("bot_sessions")
      .upsert(
        {
          customer_phone: phone,
          current_step: "owner_payment_method",
          updated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        },
        { onConflict: "customer_phone" }
      );

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("send-suspension-notice error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
