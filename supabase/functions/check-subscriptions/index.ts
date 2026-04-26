import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string | null | undefined) {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned || null;
}

async function sendWhatsAppText(
  phone: string,
  bodyText: string,
  accessToken: string,
  phoneNumberId: string,
) {
  await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
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
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date().toISOString().split("T")[0];
    const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const { data: settingsData } = await supabase.from("app_settings").select("key, value");
    const settings: Record<string, string> = {};
    if (settingsData) {
      settingsData.forEach((row: { key: string; value: string }) => {
        settings[row.key] = row.value;
      });
    }

    const accessToken = settings.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = settings.WHATSAPP_PHONE_NUMBER_ID;
    const adminAlertPhone = normalizePhone(settings.PUBLIC_CONTACT_WHATSAPP || settings.ADMIN_WHATSAPP_PHONE);

    let warned = 0;
    let processed = 0;
    let missingQuotaAlerts = 0;

    const { data: expiringSoon } = await supabase
      .from("subscriptions")
      .select("id, station_id")
      .in("status", ["active", "trial"])
      .eq("end_date", threeDaysLater);

    for (const sub of expiringSoon || []) {
      const { data: owner } = await supabase
        .from("station_owners")
        .select("user_id, owner_phone, stations(name)")
        .eq("station_id", sub.station_id)
        .maybeSingle();

      if (!owner) continue;

      await supabase.from("notifications").insert({
        user_id: owner.user_id,
        title: "اشتراكك ينتهي قريباً",
        body: `اشتراك محطة "${(owner.stations as { name?: string } | null)?.name || "محطتك"}" سينتهي خلال 3 أيام. يرجى التجديد قبل توقف الظهور على الخريطة.`,
        type: "subscription",
      });

      const ownerPhone = normalizePhone(owner.owner_phone);
      if (ownerPhone && accessToken && phoneNumberId) {
        const msg =
          `⚠️ تنبيه اشتراك\n\n` +
          `اشتراك محطة "${(owner.stations as { name?: string } | null)?.name || "محطتك"}" سينتهي خلال 3 أيام (${threeDaysLater}).\n` +
          `يرجى تجديد الاشتراك الآن حتى لا تخسر ظهورك على الخريطة ولا تفقد زبائنك.`;
        await sendWhatsAppText(ownerPhone, msg, accessToken, phoneNumberId);
      }

      warned++;
    }

    const { data: expired, error: fetchErr } = await supabase
      .from("subscriptions")
      .select("id, station_id, status")
      .in("status", ["active", "trial"])
      .lt("end_date", today);

    if (fetchErr) throw fetchErr;

    for (const sub of expired || []) {
      await supabase
        .from("subscriptions")
        .update({
          status: "expired",
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);

      await supabase
        .from("stations")
        .update({
          is_active: false,
          suspension_reason: "subscription_expired",
          suspended_at: new Date().toISOString(),
        })
        .eq("id", sub.station_id);

      const { data: owner } = await supabase
        .from("station_owners")
        .select("user_id, owner_phone, stations(name)")
        .eq("station_id", sub.station_id)
        .maybeSingle();

      if (owner) {
        await supabase.from("notifications").insert({
          user_id: owner.user_id,
          title: "انتهى اشتراكك",
          body: "تم إيقاف ظهور محطتك على الخريطة بسبب انتهاء الاشتراك. جدد باقتك الآن كي لا تخسر زبائنك.",
          type: "subscription",
        });

        const ownerPhone = normalizePhone(owner.owner_phone);
        if (ownerPhone && accessToken && phoneNumberId) {
          const msg =
            `🚫 انتهى اشتراك محطة "${(owner.stations as { name?: string } | null)?.name || "محطتك"}".\n` +
            `تم إيقاف ظهورها على الخريطة حتى يتم التجديد.\n` +
            `جدد اشتراكك الآن حتى لا تخسر الزبائن والحجوزات الجديدة.`;
          await sendWhatsAppText(ownerPhone, msg, accessToken, phoneNumberId);
        }
      }

      processed++;
    }

    if (adminAlertPhone && accessToken && phoneNumberId) {
      const { data: ownersWithoutQuota } = await supabase
        .from("station_owners")
        .select("id, owner_name, owner_phone, free_requests_quota, stations(name)")
        .or("free_requests_quota.is.null,free_requests_quota.lte.0");

      for (const owner of ownersWithoutQuota || []) {
        const stationName = (owner.stations as { name?: string } | null)?.name || "محطة بدون اسم";
        const ownerPhone = normalizePhone(owner.owner_phone) || "لا يوجد رقم";
        const adminMessage =
          `🔔 تنبيه إعدادات المحطات\n\n` +
          `المحطة: ${stationName}\n` +
          `المالك: ${owner.owner_name || "غير محدد"}\n` +
          `رقم المالك: ${ownerPhone}\n\n` +
          `هذه المحطة لا تحتوي على عدد طلبات مجانية ممنوحة من قبل الإدارة.\n` +
          `يرجى فتح حساب المالك وإدخال الرقم المناسب حتى يعمل منطق الباقات بشكل صحيح.`;

        await sendWhatsAppText(adminAlertPhone, adminMessage, accessToken, phoneNumberId);
        missingQuotaAlerts++;
      }
    }

    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    for (const admin of admins || []) {
      await supabase.from("notifications").insert({
        user_id: admin.user_id,
        title: `${processed} اشتراك منتهي${warned > 0 ? ` / ${warned} تنبيه مبكر` : ""}${missingQuotaAlerts > 0 ? ` / ${missingQuotaAlerts} محطة تحتاج ضبط المجاني` : ""}`,
        body:
          `تم تعطيل ${processed} محطة بسبب انتهاء الاشتراك.` +
          `${warned > 0 ? ` وتم إرسال ${warned} تنبيه اقتراب انتهاء.` : ""}` +
          `${missingQuotaAlerts > 0 ? ` كما تم تنبيه رقم الفوتر بخصوص ${missingQuotaAlerts} محطة بلا عدد مجاني.` : ""}`,
        type: "subscription",
      });
    }

    return new Response(
      JSON.stringify({
        message: "Done",
        warned,
        processed,
        missingQuotaAlerts,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
