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
    for (const row of settingsData || []) {
      settings[row.key] = row.value;
    }

    const accessToken = settings.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = settings.WHATSAPP_PHONE_NUMBER_ID;
    const adminAlertPhone = normalizePhone(
      settings.PUBLIC_CONTACT_WHATSAPP || settings.ADMIN_WHATSAPP_PHONE,
    );

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
        .select("owner_phone, stations(name)")
        .eq("station_id", sub.station_id)
        .maybeSingle();

      const ownerPhone = normalizePhone(owner?.owner_phone);
      if (ownerPhone && accessToken && phoneNumberId) {
        const stationName = (owner?.stations as { name?: string } | null)?.name || "محطتك";
        const msg =
          `مرحباً، باقة محطة "${stationName}" ستنتهي خلال 3 أيام (${threeDaysLater}).\n` +
          `يسعدنا أن تقوم بالتجديد في الوقت المناسب حتى يستمر ظهور محطتك في الخريطة واستقبال الحجوزات الجديدة بسهولة.`;
        await sendWhatsAppText(ownerPhone, msg, accessToken, phoneNumberId);
      }

      warned++;
    }

    const { data: expired, error: fetchErr } = await supabase
      .from("subscriptions")
      .select("id, station_id")
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
        .select("owner_phone, stations(name)")
        .eq("station_id", sub.station_id)
        .maybeSingle();

      const ownerPhone = normalizePhone(owner?.owner_phone);
      if (ownerPhone && accessToken && phoneNumberId) {
        const stationName = (owner?.stations as { name?: string } | null)?.name || "محطتك";
        const msg =
          `مرحباً، انتهت مدة باقة محطة "${stationName}" وتم إيقاف ظهورها مؤقتاً في الخريطة إلى حين التجديد.\n` +
          `يمكنك تحديث باقتك الآن للوصول إلى عدد أكبر من الزبائن والعودة سريعاً إلى استقبال الحجوزات الجديدة.`;
        await sendWhatsAppText(ownerPhone, msg, accessToken, phoneNumberId);
      }

      processed++;
    }

    const { data: allStations } = await supabase
      .from("stations")
      .select("id, name, is_active, suspension_reason");

    const { data: allOwners } = await supabase
      .from("station_owners")
      .select("station_id, owner_name, owner_phone, free_requests_quota, free_requests_used");

    const { data: activeSubsForVisibility } = await supabase
      .from("subscriptions")
      .select("station_id")
      .in("status", ["active", "trial"])
      .gte("end_date", today);

    const activeStationIds = new Set((activeSubsForVisibility || []).map((row) => row.station_id));
    const ownerByStation = new Map((allOwners || []).map((owner) => [owner.station_id, owner]));

    for (const station of allStations || []) {
      const owner = ownerByStation.get(station.id);
      const hasFreeQuota = Number(owner?.free_requests_quota || 0) > Number(owner?.free_requests_used || 0);
      const hasActivePackage = activeStationIds.has(station.id);
      const hiddenByQuota = station.suspension_reason === "free_quota_exhausted";
      const manuallyHidden = station.suspension_reason === "manual";
      const hiddenByOtherSubscriptionReason =
        station.suspension_reason === "package_exhausted" ||
        station.suspension_reason === "subscription_expired";

      if (!hasFreeQuota && !hasActivePackage) {
        if (manuallyHidden || hiddenByOtherSubscriptionReason) {
          continue;
        }

        if (station.is_active !== false || !hiddenByQuota) {
          await supabase
            .from("stations")
            .update({
              is_active: false,
              suspension_reason: "free_quota_exhausted",
              suspended_at: new Date().toISOString(),
            })
            .eq("id", station.id);

          if (adminAlertPhone && accessToken && phoneNumberId) {
            const ownerPhone = normalizePhone(owner?.owner_phone) || "لا يوجد رقم";
            const adminMessage =
              `تنبيه إعدادات المحطات\n\n` +
              `المحطة: ${station.name || "محطة بدون اسم"}\n` +
              `المالك: ${owner?.owner_name || "غير محدد"}\n` +
              `رقم المالك: ${ownerPhone}\n\n` +
              `هذه المحطة لا تحتوي على رقم يمثل الطلبات المجانية الممنوحة من قبل الإدارة، كما لا تملك باقة فعالة.\n` +
              `تم إخفاؤها تلقائياً من الخريطة إلى حين إضافة رقم مناسب للطلبات المجانية أو تفعيل باقة فعالة.`;

            await sendWhatsAppText(adminAlertPhone, adminMessage, accessToken, phoneNumberId);
            missingQuotaAlerts++;
          }
        }

        continue;
      }

      if (hiddenByQuota && (hasFreeQuota || hasActivePackage)) {
        await supabase
          .from("stations")
          .update({
            is_active: true,
            suspension_reason: null,
            suspended_at: null,
          })
          .eq("id", station.id);
      }
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
