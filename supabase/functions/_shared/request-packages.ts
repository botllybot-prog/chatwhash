import { createClient } from "npm:@supabase/supabase-js@2";

export const PACKAGE_DEFINITIONS = {
  starter_20: {
    code: "starter_20",
    title_ar: "باقة 20 طلب",
    title_en: "20 Request Pack",
    title_ku: "پاکێجی 20 داوا",
    title_tr: "20 Talep Paketi",
    price_usd: 5,
    request_limit: 20,
    plan: "basic",
  },
  growth_50: {
    code: "growth_50",
    title_ar: "باقة 50 طلب",
    title_en: "50 Request Pack",
    title_ku: "پاکێجی 50 داوا",
    title_tr: "50 Talep Paketi",
    price_usd: 10,
    request_limit: 50,
    plan: "pro",
  },
  scale_110: {
    code: "scale_110",
    title_ar: "باقة 110 طلب",
    title_en: "110 Request Pack",
    title_ku: "پاکێجی 110 داوا",
    title_tr: "110 Talep Paketi",
    price_usd: 20,
    request_limit: 110,
    plan: "premium",
  },
  unlimited_30: {
    code: "unlimited_30",
    title_ar: "باقة غير محدودة",
    title_en: "Unlimited Pack",
    title_ku: "پاکێجی بێ سنوور",
    title_tr: "Sınırsız Paket",
    price_usd: 50,
    request_limit: null,
    plan: "premium",
  },
} as const;

const ADMIN_CONTACT_PHONE = "07836635435";

type SupabaseClient = ReturnType<typeof createClient>;

function normalizePhone(phone: string | null | undefined) {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned || null;
}

export async function loadAppSettings(supabase: SupabaseClient) {
  const { data } = await supabase.from("app_settings").select("key, value");
  const settings: Record<string, string> = {};
  for (const row of data || []) {
    settings[row.key] = row.value;
  }
  return settings;
}

export async function sendWhatsAppText(
  phone: string | null,
  body: string,
  settings: Record<string, string>,
) {
  const normalizedPhone = normalizePhone(phone);
  const accessToken = settings.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = settings.WHATSAPP_PHONE_NUMBER_ID;

  if (!normalizedPhone || !accessToken || !phoneNumberId) return;

  await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizedPhone,
      type: "text",
      text: { body },
    }),
  });
}

type ConsumeQuotaInput = {
  supabase: SupabaseClient;
  settings: Record<string, string>;
  stationId: string;
};

type ConsumeQuotaResult =
  | {
      allowed: true;
      source: "free" | "subscription";
      remaining: number | null;
      packageCode: string | null;
    }
  | {
      allowed: false;
      reason: "free_quota_exhausted" | "package_exhausted" | "subscription_required";
      message: string;
    };

export async function consumeStationRequestQuota({
  supabase,
  settings,
  stationId,
}: ConsumeQuotaInput): Promise<ConsumeQuotaResult> {
  const nowIso = new Date().toISOString();
  const today = nowIso.split("T")[0];

  const [{ data: station }, { data: owner }, { data: activeSubscription }] = await Promise.all([
    supabase
      .from("stations")
      .select("id, name, is_active, suspension_reason")
      .eq("id", stationId)
      .maybeSingle(),
    supabase
      .from("station_owners")
      .select("id, owner_name, owner_phone, free_requests_quota, free_requests_used, station_id")
      .eq("station_id", stationId)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("id, package_code, request_limit, requests_used, status, warning_sent_at, exhausted_notified_at, end_date")
      .eq("station_id", stationId)
      .in("status", ["active", "trial"])
      .gte("end_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const stationName = station?.name || "المحطة";
  const ownerPhone = owner?.owner_phone || null;
  const contactAdminLine = `\n\nللاستمرار بالظهور على الخريطة واستقبال الزبائن، تواصل مع الإدارة على واتساب: ${ADMIN_CONTACT_PHONE}`;

  const warnOwner = async (body: string) => {
    await sendWhatsAppText(ownerPhone, body, settings);
  };

  const hideStation = async (
    reason: "free_quota_exhausted" | "package_exhausted" | "subscription_expired",
  ) => {
    await supabase
      .from("stations")
      .update({
        is_active: false,
        suspension_reason: reason,
        suspended_at: nowIso,
      })
      .eq("id", stationId);
  };

  const freeQuota = Number(owner?.free_requests_quota ?? 0);
  const freeUsed = Number(owner?.free_requests_used ?? 0);

  if (freeQuota > freeUsed) {
    const nextUsed = freeUsed + 1;
    const remaining = Math.max(0, freeQuota - nextUsed);

    await supabase
      .from("station_owners")
      .update({ free_requests_used: nextUsed })
      .eq("id", owner?.id);

    if (remaining === 5) {
      await warnOwner(
        `مرحباً، باقة الطلبات المجانية في محطة ${stationName} شارفت على الانتهاء، والمتبقي 5 طلبات فقط.${contactAdminLine}`,
      );
    }

    if (remaining === 0 && !activeSubscription) {
      await hideStation("free_quota_exhausted");
      await warnOwner(
        `مرحباً، انتهت الطلبات المجانية الخاصة بمحطة ${stationName}.\nتم إيقاف ظهور المحطة مؤقتاً إلى حين تفعيل طلبات جديدة.${contactAdminLine}`,
      );
    }

    return {
      allowed: true,
      source: "free",
      remaining,
      packageCode: null,
    };
  }

  if (activeSubscription) {
    const currentUsed = Number(activeSubscription.requests_used ?? 0);
    const requestLimit =
      activeSubscription.request_limit === null
        ? null
        : Number(activeSubscription.request_limit);

    if (requestLimit === null) {
      await supabase
        .from("subscriptions")
        .update({
          requests_used: currentUsed + 1,
          updated_at: nowIso,
        })
        .eq("id", activeSubscription.id);

      return {
        allowed: true,
        source: "subscription",
        remaining: null,
        packageCode: activeSubscription.package_code || "unlimited_30",
      };
    }

    if (currentUsed >= requestLimit) {
      await hideStation("package_exhausted");

      if (!activeSubscription.exhausted_notified_at) {
        await supabase
          .from("subscriptions")
          .update({
            status: "expired",
            exhausted_notified_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", activeSubscription.id);

        await warnOwner(
          `مرحباً، انتهت باقة الطلبات الخاصة بمحطة ${stationName} وتم إيقاف ظهورها على الخريطة مؤقتاً.${contactAdminLine}`,
        );
      }

      return {
        allowed: false,
        reason: "package_exhausted",
        message: "هذه المحطة متوقفة مؤقتاً إلى حين تحديث الباقة.",
      };
    }

    const nextUsed = currentUsed + 1;
    const remaining = requestLimit - nextUsed;

    await supabase
      .from("subscriptions")
      .update({
        requests_used: nextUsed,
        warning_sent_at:
          remaining === 5 && !activeSubscription.warning_sent_at
            ? nowIso
            : activeSubscription.warning_sent_at,
        status: remaining <= 0 ? "expired" : activeSubscription.status,
        exhausted_notified_at:
          remaining <= 0 ? nowIso : activeSubscription.exhausted_notified_at,
        updated_at: nowIso,
      })
      .eq("id", activeSubscription.id);

    if (remaining === 5 && !activeSubscription.warning_sent_at) {
      await warnOwner(
        `مرحباً، باقتك الحالية في محطة ${stationName} شارفت على الانتهاء، والمتبقي 5 طلبات فقط.${contactAdminLine}`,
      );
    }

    if (remaining <= 0) {
      await hideStation("package_exhausted");
      await warnOwner(
        `مرحباً، انتهت باقتك الحالية في محطة ${stationName} بعد استهلاك جميع الطلبات.\nتم إيقاف ظهور المحطة مؤقتاً إلى حين التجديد.${contactAdminLine}`,
      );
    }

    return {
      allowed: true,
      source: "subscription",
      remaining: Math.max(0, remaining),
      packageCode: activeSubscription.package_code || null,
    };
  }

  await hideStation("free_quota_exhausted");
  await warnOwner(
    `مرحباً، لا توجد طلبات مجانية متبقية لمحطة ${stationName} ولا توجد باقة فعالة حالياً.\nتم إيقاف ظهور المحطة مؤقتاً إلى حين التحديث.${contactAdminLine}`,
  );

  return {
    allowed: false,
    reason: "subscription_required",
    message: "هذه المحطة متوقفة مؤقتاً إلى حين تفعيل الباقة.",
  };
}
