import { supabase } from "./supabase";
import type {
  OwnerContext,
  PackageDefinition,
  PaymentRow,
  SubscriptionSummary,
} from "../types";

export type OwnerPaymentMethods = {
  zainCash: string;
  rafidain: string;
  nasWallet: string;
  cardUrl: string;
};

export const OWNER_PACKAGES: PackageDefinition[] = [
  {
    code: "starter_20",
    title: "باقة 20 طلب",
    priceUsd: 5,
    requestLimit: 20,
    description: "مناسبة للانطلاق السريع.",
  },
  {
    code: "growth_50",
    title: "باقة 50 طلب",
    priceUsd: 10,
    requestLimit: 50,
    description: "أفضل توازن بين السعر والطلبات.",
  },
  {
    code: "scale_110",
    title: "باقة 110 طلب",
    priceUsd: 20,
    requestLimit: 110,
    description: "للمحطات النشطة ذات الطلب العالي.",
  },
  {
    code: "unlimited_30",
    title: "باقة غير محدودة",
    priceUsd: 50,
    requestLimit: null,
    description: "تشغيل مكثف بدون سقف.",
  },
];

function normalizeMaybeNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export async function getSignedInUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export async function loadOwnerContext(userId: string): Promise<OwnerContext> {
  const { data, error } = await (supabase as any)
    .from("station_owners")
    .select(
      "id, station_id, owner_name, owner_phone, free_requests_quota, free_requests_used, stations(name, is_active, suspension_reason)",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message || "تعذر تحميل بيانات صاحب المحطة.");
  }

  return {
    stationOwnerId: data.id,
    stationId: data.station_id,
    ownerName: data.owner_name || "",
    ownerPhone: data.owner_phone || "",
    freeRequestsQuota: normalizeMaybeNumber(data.free_requests_quota, 0),
    freeRequestsUsed: normalizeMaybeNumber(data.free_requests_used, 0),
    stationName: data.stations?.name || "محطتي",
    stationIsActive: !!data.stations?.is_active,
    suspensionReason: data.stations?.suspension_reason || null,
  };
}

export async function loadLatestSubscription(stationId: string): Promise<SubscriptionSummary | null> {
  const { data, error } = await (supabase as any)
    .from("subscriptions")
    .select("id, package_code, request_limit, requests_used, status, start_date, end_date, amount")
    .eq("station_id", stationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id,
    packageCode: data.package_code || null,
    requestLimit: data.request_limit === null ? null : normalizeMaybeNumber(data.request_limit, 0),
    requestsUsed: normalizeMaybeNumber(data.requests_used, 0),
    status: data.status || "unknown",
    startDate: data.start_date || null,
    endDate: data.end_date || null,
    amount: data.amount === null || data.amount === undefined ? null : normalizeMaybeNumber(data.amount, 0),
  };
}

export async function loadPayments(subscriptionId: string): Promise<PaymentRow[]> {
  const { data, error } = await (supabase as any)
    .from("payments")
    .select("id, amount, method, status, payment_date")
    .eq("subscription_id", subscriptionId)
    .order("payment_date", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);

  return (data || []).map((row: any) => ({
    id: row.id,
    amount: normalizeMaybeNumber(row.amount, 0),
    method: row.method || null,
    status: row.status || "pending",
    paymentDate: row.payment_date || null,
  }));
}

export function getPackageByCode(code: string | null | undefined) {
  return OWNER_PACKAGES.find((item) => item.code === code) || null;
}

export async function loadOwnerPaymentMethods(): Promise<OwnerPaymentMethods> {
  const { data, error } = await (supabase as any)
    .from("app_settings")
    .select("key, value")
    .in("key", ["PAYMENT_ZAIN_CASH", "PAYMENT_SUPER_KEY", "PAYMENT_NAS_WALLET", "PAYMENT_CARD_URL"]);

  if (error) {
    throw new Error(error.message);
  }

  const map: Record<string, string> = {};
  for (const row of data || []) {
    map[row.key] = row.value || "";
  }

  return {
    zainCash: map.PAYMENT_ZAIN_CASH || "",
    rafidain: map.PAYMENT_SUPER_KEY || "",
    nasWallet: map.PAYMENT_NAS_WALLET || "",
    cardUrl: map.PAYMENT_CARD_URL || "",
  };
}
