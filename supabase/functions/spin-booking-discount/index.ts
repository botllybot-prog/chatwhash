import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISCOUNT_SEGMENTS = [
  { key: "discount_0", discountPercent: 0, label: "0%", weight: 1 },
  { key: "discount_5", discountPercent: 5, label: "5%", weight: 1 },
  { key: "discount_10", discountPercent: 10, label: "10%", weight: 1 },
  { key: "discount_15", discountPercent: 15, label: "15%", weight: 1 },
] as const;

type DiscountSegment = (typeof DISCOUNT_SEGMENTS)[number];

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned;
}

function toBase64Url(input: Uint8Array | string): string {
  const raw = typeof input === "string" ? input : String.fromCharCode(...input);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signValue(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return toBase64Url(new Uint8Array(signature));
}

function pickDiscountSegment(): DiscountSegment {
  const totalWeight = DISCOUNT_SEGMENTS.reduce((sum, segment) => sum + segment.weight, 0);
  let randomPoint = Math.random() * totalWeight;

  for (const segment of DISCOUNT_SEGMENTS) {
    randomPoint -= segment.weight;
    if (randomPoint < 0) return segment;
  }

  return DISCOUNT_SEGMENTS[0];
}

function businessError(message: string) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
    const stationId = body.station_id as string | undefined;
    const serviceId = body.service_id as string | undefined;
    const bookingDate = body.booking_date as string | undefined;
    const bookingTime = (body.booking_time as string | null | undefined) || null;
    const customerPhone = normalizePhone((body.customer_phone as string | undefined)?.trim() || "");

    if (!stationId || !serviceId || !bookingDate || !customerPhone) {
      return businessError("بيانات الحجز غير مكتملة لتدوير العجلة.");
    }

    let existingBookingQuery = supabase
      .from("bookings")
      .select("id, booking_number")
      .eq("station_id", stationId)
      .eq("service_id", serviceId)
      .eq("booking_date", bookingDate)
      .eq("customer_phone", customerPhone)
      .in("status", ["pending", "confirmed"]);

    existingBookingQuery = bookingTime
      ? existingBookingQuery.eq("booking_time", bookingTime)
      : existingBookingQuery.is("booking_time", null);

    const { data: existingBooking } = await existingBookingQuery.maybeSingle();

    if (existingBooking) {
      return businessError(`تم استخدام عجلة الخصم لهذا الحجز بالفعل برقم #${existingBooking.booking_number}.`);
    }

    const { count: activeBookingsCount, error: activeBookingsError } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("customer_phone", customerPhone)
      .in("status", ["pending", "confirmed"]);

    if (activeBookingsError) {
      return new Response(JSON.stringify({ error: "تعذر التحقق من الحجوزات الحالية." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((activeBookingsCount || 0) >= 2) {
      return businessError("لديك بالفعل حجزان نشطان على هذا الرقم. ألغ أحدهما أولاً قبل تدوير العجلة.");
    }

    const segment = pickDiscountSegment();
    const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!secret) {
      return new Response(JSON.stringify({ error: "تعذر إنشاء توقيع الخصم." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      station_id: stationId,
      service_id: serviceId,
      booking_date: bookingDate,
      booking_time: bookingTime,
      customer_phone: customerPhone,
      discount_percent: segment.discountPercent,
      issued_at: Date.now(),
      expires_at: Date.now() + 15 * 60 * 1000,
    };

    const encodedPayload = toBase64Url(JSON.stringify(payload));
    const signature = await signValue(encodedPayload, secret);
    const token = `${encodedPayload}.${signature}`;

    return new Response(
      JSON.stringify({
        success: true,
        segmentKey: segment.key,
        discountPercent: segment.discountPercent,
        label: segment.label,
        token,
        requiresRespin: false,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
