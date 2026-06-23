import { createClient } from "npm:@supabase/supabase-js@2";

export const PACKAGE_DEFINITIONS = {
  starter_20: {
    code: "starter_20",
    title_ar: "باقة 20 طلب",
    title_en: "20 Request Pack",
    title_ku: "پاكێجی 20 داوا",
    title_tr: "20 Talep Paketi",
    price_usd: 5,
    request_limit: 20,
    plan: "basic",
  },
  growth_50: {
    code: "growth_50",
    title_ar: "باقة 50 طلب",
    title_en: "50 Request Pack",
    title_ku: "پاكێجی 50 داوا",
    title_tr: "50 Talep Paketi",
    price_usd: 10,
    request_limit: 50,
    plan: "pro",
  },
  scale_110: {
    code: "scale_110",
    title_ar: "باقة 110 طلب",
    title_en: "110 Request Pack",
    title_ku: "پاكێجی 110 داوا",
    title_tr: "110 Talep Paketi",
    price_usd: 20,
    request_limit: 110,
    plan: "premium",
  },
  unlimited_30: {
    code: "unlimited_30",
    title_ar: "باقة غير محدودة",
    title_en: "Unlimited Pack",
    title_ku: "پاكێجی بێ سنوور",
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
  for (const row of data || []) settings[row.key] = row.value;
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

async function callSuspensionNotice(ownerId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return false;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-suspension-notice`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        owner_id: ownerId,
        reason: "free_quota_exhausted",
        source: "request-quota",
      }),
    });

    if (!response.ok) {
      console.error("send-suspension-notice failed", await response.text().catch(() => ""));
      return false;
    }

    return true;
  } catch (error) {
    console.error("send-suspension-notice invoke error", error);
    return false;
  }
}

export async function consumeStationRequestQuota({
  supabase,
  settings,
  stationId,
}: ConsumeQuotaInput): Promise<ConsumeQuotaResult> {
  const nowIso = new Date().toISOString();
  const today = nowIso.split("T")[0];

  const [{ data: station }, { data: owner }, { data: unlimitedSubscription }] = await Promise.all([
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
      .select("id, package_code, request_limit, requests_used, status, end_date")
      .eq("station_id", stationId)
      .in("status", ["active", "trial"])
      .is("request_limit", null)
      .gte("end_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const stationName = station?.name || "المحطة";
  const ownerPhone = owner?.owner_phone || null;
  const contactAdminLine =
    `\n\nللاستمرار بالظهور على الخريطة واستقبال الزبائن، تواصل مع الإدارة على واتساب: ${ADMIN_CONTACT_PHONE}`;

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

  const notifySuspension = async () => {
    if (owner?.id && await callSuspensionNotice(owner.id)) return;
    await sendWhatsAppText(
      ownerPhone,
      `مرحبا، انتهى رصيد الطلبات لمحطة ${stationName} وتم إيقاف ظهورها مؤقتا على الخريطة.${contactAdminLine}`,
      settings,
    );
  };

  const freeQuota = Math.max(0, Number(owner?.free_requests_quota ?? 0));
  const freeUsed = Math.max(0, Number(owner?.free_requests_used ?? 0));

  if (freeQuota > 0) {
    const remaining = freeQuota - 1;
    await supabase
      .from("station_owners")
      .update({
        free_requests_quota: remaining,
        free_requests_used: freeUsed + 1,
      })
      .eq("id", owner?.id);

    if (remaining === 5) {
      await sendWhatsAppText(
        ownerPhone,
        `مرحبا، رصيد طلبات محطة ${stationName} شارف على الانتهاء، والمتبقي 5 طلبات فقط.${contactAdminLine}`,
        settings,
      );
    }

    if (remaining === 0) {
      await hideStation("free_quota_exhausted");
      await notifySuspension();
    }

    return {
      allowed: true,
      source: "free",
      remaining,
      packageCode: null,
    };
  }

  if (unlimitedSubscription) {
    await supabase
      .from("subscriptions")
      .update({
        requests_used: Number(unlimitedSubscription.requests_used ?? 0) + 1,
        updated_at: nowIso,
      })
      .eq("id", unlimitedSubscription.id);

    return {
      allowed: true,
      source: "subscription",
      remaining: null,
      packageCode: unlimitedSubscription.package_code || "unlimited_30",
    };
  }

  await hideStation("free_quota_exhausted");
  await notifySuspension();

  return {
    allowed: false,
    reason: "subscription_required",
    message: "هذه المحطة متوقفة مؤقتا إلى حين تفعيل رصيد طلبات جديد.",
  };
}
