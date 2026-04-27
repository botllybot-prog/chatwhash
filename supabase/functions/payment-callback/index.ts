import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const DEFAULT_RETURN_URL = "https://washlly.com/app/station-portal";

type PackageCode = "starter_20" | "growth_50" | "scale_110" | "unlimited_30";

const PACKAGE_DEFINITIONS: Record<PackageCode, {
  code: PackageCode;
  plan: "basic" | "pro" | "premium";
  label: string;
  requestLimit: number | null;
  priceUsd: number;
}> = {
  starter_20: {
    code: "starter_20",
    plan: "basic",
    label: "باقة 20 طلب",
    requestLimit: 20,
    priceUsd: 5,
  },
  growth_50: {
    code: "growth_50",
    plan: "pro",
    label: "باقة 50 طلب",
    requestLimit: 50,
    priceUsd: 10,
  },
  scale_110: {
    code: "scale_110",
    plan: "premium",
    label: "باقة 110 طلب",
    requestLimit: 110,
    priceUsd: 20,
  },
  unlimited_30: {
    code: "unlimited_30",
    plan: "premium",
    label: "باقة غير محدودة",
    requestLimit: null,
    priceUsd: 50,
  },
};

function isUuid(value: string | null | undefined) {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toSingleValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.length ? String(value[0]) : null;
  const stringValue = String(value).trim();
  return stringValue.length ? stringValue : null;
}

function normalizeGatewayStatus(input: string | null) {
  const value = (input || "").trim().toLowerCase();
  if (!value) return "pending" as const;

  if (["paid", "success", "successful", "approved", "captured", "complete", "completed", "ok"].includes(value)) {
    return "paid" as const;
  }
  if (["failed", "failure", "declined", "rejected", "error", "cancelled", "canceled"].includes(value)) {
    return "failed" as const;
  }
  if (["refunded", "refund"].includes(value)) {
    return "refunded" as const;
  }
  return "pending" as const;
}

function resolveReturnUrl(candidate: string | null) {
  if (!candidate) return DEFAULT_RETURN_URL;
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol)) return DEFAULT_RETURN_URL;
    return url.toString();
  } catch {
    return DEFAULT_RETURN_URL;
  }
}

async function parsePayload(req: Request) {
  const url = new URL(req.url);
  const payload: Record<string, unknown> = {};

  url.searchParams.forEach((value, key) => {
    payload[key] = value;
  });

  if (req.method === "POST") {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const json = await req.json().catch(() => ({}));
      if (json && typeof json === "object") Object.assign(payload, json);
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      for (const [key, value] of form.entries()) payload[key] = value;
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      for (const [key, value] of form.entries()) payload[key] = value;
    } else {
      const text = await req.text().catch(() => "");
      if (text) {
        try {
          const maybeJson = JSON.parse(text);
          if (maybeJson && typeof maybeJson === "object") Object.assign(payload, maybeJson);
        } catch {
          payload.raw_body = text;
        }
      }
    }
  }

  return payload;
}

function buildRedirectUrl(baseUrl: string, params: Record<string, string | null | undefined>) {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!["GET", "POST"].includes(req.method)) {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const payload = await parsePayload(req);
    const subscriptionId = toSingleValue(payload.subscription_id) || toSingleValue(payload.subscriptionId);
    const stationId = toSingleValue(payload.station_id) || toSingleValue(payload.stationId);
    const packageCodeInput = toSingleValue(payload.package_code) || toSingleValue(payload.packageCode);
    const returnUrl = resolveReturnUrl(
      toSingleValue(payload.return_url) ||
      toSingleValue(payload.redirection_url) ||
      toSingleValue(payload.redirect_url) ||
      toSingleValue(payload.success_url),
    );
    const transactionId =
      toSingleValue(payload.transaction_id) ||
      toSingleValue(payload.transactionId) ||
      toSingleValue(payload.gateway_reference) ||
      toSingleValue(payload.reference) ||
      toSingleValue(payload.ref);
    const paymentMethod =
      toSingleValue(payload.method) ||
      toSingleValue(payload.payment_method) ||
      toSingleValue(payload.gateway) ||
      "card_gateway";
    const amountValue =
      toSingleValue(payload.amount) ||
      toSingleValue(payload.total) ||
      toSingleValue(payload.payment_amount);
    const amount = amountValue ? Number(amountValue) : null;
    const packageCode = (packageCodeInput && packageCodeInput in PACKAGE_DEFINITIONS
      ? packageCodeInput
      : "starter_20") as PackageCode;
    const packageDef = PACKAGE_DEFINITIONS[packageCode];
    const paymentStatus = normalizeGatewayStatus(
      toSingleValue(payload.status) ||
      toSingleValue(payload.payment_status) ||
      toSingleValue(payload.result) ||
      toSingleValue(payload.state) ||
      (toSingleValue(payload.success) === "true" ? "success" : null),
    );

    let subscription: any = null;

    if (isUuid(subscriptionId)) {
      const { data } = await (supabase as any)
        .from("subscriptions")
        .select("*")
        .eq("id", subscriptionId)
        .maybeSingle();
      subscription = data;
    }

    if (!subscription && isUuid(stationId)) {
      const { data } = await (supabase as any)
        .from("subscriptions")
        .select("*")
        .eq("station_id", stationId)
        .in("status", ["active", "trial", "expired", "cancelled"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      subscription = data;
    }

    const now = new Date();
    const startDate = now.toISOString().split("T")[0];
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const paidAmount = Number.isFinite(amount) ? Number(amount) : packageDef.priceUsd;

    if (paymentStatus === "paid") {
      if (subscription) {
        const { data: updatedSub, error: subUpdateError } = await (supabase as any)
          .from("subscriptions")
          .update({
            plan: packageDef.plan,
            package_code: packageDef.code,
            request_limit: packageDef.requestLimit,
            requests_used: 0,
            warning_sent_at: null,
            exhausted_notified_at: null,
            amount: paidAmount,
            status: "active",
            start_date: startDate,
            end_date: endDate,
            paid_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq("id", subscription.id)
          .select()
          .single();
        if (subUpdateError) throw subUpdateError;
        subscription = updatedSub;
      } else if (isUuid(stationId)) {
        const { data: insertedSub, error: subInsertError } = await (supabase as any)
          .from("subscriptions")
          .insert({
            station_id: stationId,
            plan: packageDef.plan,
            package_code: packageDef.code,
            request_limit: packageDef.requestLimit,
            requests_used: 0,
            warning_sent_at: null,
            exhausted_notified_at: null,
            status: "active",
            amount: paidAmount,
            start_date: startDate,
            end_date: endDate,
            paid_at: now.toISOString(),
          })
          .select()
          .single();
        if (subInsertError) throw subInsertError;
        subscription = insertedSub;
      }

      if (subscription?.id) {
        const paymentNotes = [
          transactionId ? `Gateway reference: ${transactionId}` : null,
          `Callback source: payment gateway`,
          `Payload: ${JSON.stringify(payload)}`,
        ].filter(Boolean).join("\n");

        await (supabase as any).from("payments").insert({
          subscription_id: subscription.id,
          amount: paidAmount,
          method: paymentMethod,
          notes: paymentNotes,
          status: "paid",
          payment_date: now.toISOString(),
        });

        await Promise.all([
          (supabase as any)
            .from("stations")
            .update({
              is_active: true,
              suspension_reason: null,
              suspended_at: null,
            })
            .eq("id", subscription.station_id),
          (supabase as any)
            .from("station_owners")
            .update({
              is_active: true,
              outstanding_debt: 0,
            })
            .eq("station_id", subscription.station_id),
        ]);
      }
    } else if (subscription?.id) {
      const paymentNotes = [
        transactionId ? `Gateway reference: ${transactionId}` : null,
        `Callback source: payment gateway`,
        `Payload: ${JSON.stringify(payload)}`,
      ].filter(Boolean).join("\n");

      await (supabase as any).from("payments").insert({
        subscription_id: subscription.id,
        amount: paidAmount,
        method: paymentMethod,
        notes: paymentNotes,
        status: paymentStatus,
        payment_date: now.toISOString(),
      });
    }

    const redirectUrl = buildRedirectUrl(returnUrl, {
      payment: paymentStatus,
      package: packageCode,
      reference: transactionId,
      subscription_id: subscription?.id || subscriptionId || undefined,
    });

    const wantsJson = new URL(req.url).searchParams.get("response") === "json" || req.headers.get("accept")?.includes("application/json");
    if (wantsJson) {
      return new Response(JSON.stringify({
        success: true,
        callback_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/payment-callback`,
        redirect_url: redirectUrl,
        payment_status: paymentStatus,
        subscription_id: subscription?.id || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return Response.redirect(redirectUrl, 302);
  } catch (error) {
    const fallbackUrl = buildRedirectUrl(DEFAULT_RETURN_URL, {
      payment: "error",
      message: error instanceof Error ? error.message : "Unexpected error",
    });

    const wantsJson = req.headers.get("accept")?.includes("application/json") || new URL(req.url).searchParams.get("response") === "json";
    if (wantsJson) {
      return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return Response.redirect(fallbackUrl, 302);
  }
});
