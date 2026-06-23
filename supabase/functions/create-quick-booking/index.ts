import { createClient } from "npm:@supabase/supabase-js@2";
import { consumeStationRequestQuota } from "../_shared/request-packages.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type StationRow = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
};

type ServiceRow = {
  id: string;
  station_id: string | null;
  name: string;
  is_active: boolean;
};

type Language = "ar" | "en" | "ku" | "tr";
type ServiceKind = "surface" | "jack" | "quick";
const QUICK_BOOKING_RADIUS_KM = 15;
const MAX_ACTIVE_BOOKINGS = 3;
const ACTIVE_BOOKING_STATUSES = ["pending", "pending_owner_approval", "pending_customer_approval", "confirmed"];

const localizedMessages: Record<
  Language,
  {
    duplicateSameTime: string;
    activeLimit: string;
    noStations: string;
    requestSent: string;
    ownerTitle: string;
    customer: string;
    phone: string;
    service: string;
    date: string;
    time: string;
    bookingNo: string;
    ownerHint: string;
    approve: string;
    reject: string;
    changeTime: string;
    services: Record<string, string>;
  }
> = {
  ar: {
    duplicateSameTime: "لديك حجز سابق في نفس الموعد، يرجى إلغاؤه أولاً.",
    activeLimit: "يمكنك امتلاك 3 حجوزات نشطة كحد أقصى. ألغِ حجزاً قديماً أولاً.",
    noStations: "لا توجد محطات متاحة حالياً لهذا النوع من الخدمة.",
    requestSent: "تم إرسال طلب الحجز السريع لأقرب 3 محطات.",
    ownerTitle: "طلب حجز سريع جديد",
    customer: "العميل",
    phone: "الهاتف",
    service: "الخدمة",
    date: "التاريخ",
    time: "الوقت",
    bookingNo: "رقم الحجز",
    ownerHint: "الرد الأسرع يحصل على الحجز.",
    approve: "✅ تأكيد",
    reject: "❌ رفض",
    changeTime: "📅 تغيير الموعد",
    services: { surface: "غسل سطحي", jack: "غسل جك" },
  },
  en: {
    duplicateSameTime: "You already have a booking at the same time. Please cancel it first.",
    activeLimit: "You can keep up to 3 active bookings. Cancel an older one first.",
    noStations: "No stations are currently available for this service type.",
    requestSent: "Quick booking request sent to the nearest 3 stations.",
    ownerTitle: "New quick booking request",
    customer: "Customer",
    phone: "Phone",
    service: "Service",
    date: "Date",
    time: "Time",
    bookingNo: "Booking number",
    ownerHint: "The fastest reply gets this booking.",
    approve: "✅ Approve",
    reject: "❌ Reject",
    changeTime: "📅 Change time",
    services: { surface: "Surface wash", jack: "Jack wash" },
  },
  ku: {
    duplicateSameTime: "لە هەمان کاتدا حجزت هەیە، تکایە سەرەتا هەڵیبوەشێنەوە.",
    activeLimit: "زۆرترین 3 حجزی چالاک دەتوانیت هەبێت. سەرەتا یەکێکی کۆن هەڵبوەشێنەوە.",
    noStations: "هیچ وێستگەیەکی بەردەست بۆ ئەم جۆرە خزمەتگوزارییە نییە.",
    requestSent: "داواکاری حجزی خێرا بۆ 3 وێستگەی نزیک نێردرا.",
    ownerTitle: "داواکاری حجزی خێرای نوێ",
    customer: "کڕیار",
    phone: "تەلەفۆن",
    service: "خزمەتگوزاری",
    date: "بەروار",
    time: "کات",
    bookingNo: "ژمارەی حجز",
    ownerHint: "خێراترین وەڵام حجزەکە وەردەگرێت.",
    approve: "✅ پەسەندکردن",
    reject: "❌ ڕەتکردنەوە",
    changeTime: "📅 گۆڕینی کات",
    services: { surface: "شۆردنی سەرەوە", jack: "شۆردنی جەک" },
  },
  tr: {
    duplicateSameTime: "Aynı saatte mevcut rezervasyonunuz var. Lütfen önce iptal edin.",
    activeLimit: "En fazla 3 aktif rezervasyonunuz olabilir. Önce eski bir rezervasyonu iptal edin.",
    noStations: "Bu hizmet türü için şu an uygun istasyon yok.",
    requestSent: "Hızlı rezervasyon isteği en yakın 3 istasyona gönderildi.",
    ownerTitle: "Yeni hızlı rezervasyon talebi",
    customer: "Müşteri",
    phone: "Telefon",
    service: "Hizmet",
    date: "Tarih",
    time: "Saat",
    bookingNo: "Rezervasyon no",
    ownerHint: "En hızlı yanıt rezervasyonu alır.",
    approve: "✅ Onayla",
    reject: "❌ Reddet",
    changeTime: "📅 Saati değiştir",
    services: { surface: "Yüzey yıkama", jack: "Kriko yıkama" },
  },
};

function normalizePhone(phone: string): string {
  const cleaned = String(phone || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.slice(1)}`;
  return cleaned;
}

function normalizeLanguage(value: unknown): Language {
  if (value === "ar" || value === "en" || value === "ku" || value === "tr") return value;
  return "ar";
}

function normalizeServiceKind(value: string): ServiceKind {
  const normalized = value.toLowerCase();
  if (normalized === "quick" || normalized.includes("fast")) {
    return "quick";
  }
  if (
    normalized === "jack" ||
    normalized.includes("جك") ||
    normalized.includes("kriko") ||
    normalized.includes("jack")
  ) {
    return "jack";
  }
  return "surface";
}

function normalizeServiceName(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function matchesServiceName(serviceName: string, requestedName: string): boolean {
  const service = normalizeServiceName(serviceName);
  const requested = normalizeServiceName(requestedName);
  if (!service || !requested) return false;
  return service === requested || service.includes(requested) || requested.includes(service);
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getSettings(supabase: any) {
  const { data } = await supabase.from("app_settings").select("key, value");
  const settings: Record<string, string> = {};
  if (data) {
    for (const row of data) settings[row.key] = row.value;
  }
  return settings;
}

type OwnerStationInfo = { ownerPhone: string; ownerActive: boolean; userId: string | null };

async function getStationOwnerInfoMap(supabase: any): Promise<Map<string, OwnerStationInfo>> {
  const { data } = await supabase
    .from("station_owners")
    .select("station_id, owner_phone, user_id, is_active, created_at")
    .not("user_id", "is", null);

  const ownerMap = new Map<string, OwnerStationInfo>();
  const sortedRows = [...(data || [])].sort((a: any, b: any) => {
    const aCreated = new Date(String(a?.created_at || 0)).getTime();
    const bCreated = new Date(String(b?.created_at || 0)).getTime();
    return bCreated - aCreated;
  });

  for (const row of sortedRows) {
    const stationId = String(row.station_id || "");
    const ownerPhone = row.owner_phone ? normalizePhone(String(row.owner_phone || "")) : "";
    const ownerActive = row.is_active !== false;
    const userId = String(row.user_id || "");
    if (!stationId || !userId) continue;
    // Keep the newest owner row per station only.
    // This ensures "suspended/paused" latest state is respected.
    if (!ownerMap.has(stationId)) {
      ownerMap.set(stationId, { ownerPhone, ownerActive, userId });
    }
  }
  return ownerMap;
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
    const language = normalizeLanguage(body.language);
    const msg = localizedMessages[language];

    const customerName = String(body.customer_name || "").trim();
    const customerPhone = normalizePhone(String(body.customer_phone || ""));
    const rawServiceKind = String(body.service_kind || "").trim();
    const serviceFilterName = rawServiceKind && normalizeServiceName(rawServiceKind) !== "quick"
      ? normalizeServiceName(rawServiceKind)
      : "";
    const bookingDate = String(body.booking_date || "").trim();
    const bookingTime = String(body.booking_time || "").trim();
    const customerLat = Number(body.customer_lat);
    const customerLng = Number(body.customer_lng);

    if (!customerName || !customerPhone || !bookingDate || !bookingTime) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: customerProfile } = await supabase
      .from("customer_profiles")
      .select("is_blocked")
      .eq("customer_phone", customerPhone)
      .maybeSingle();
    if (customerProfile?.is_blocked) {
      const message = language === "en"
        ? "This customer account is blocked from booking. Please contact support."
        : "تم حظر هذا الحساب من الحجز. يرجى التواصل مع الإدارة.";
      return new Response(JSON.stringify({ error: "customer_blocked", message }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: activeBookings, error: activeBookingsError } = await supabase
      .from("bookings")
      .select("id, station_id")
      .eq("customer_phone", customerPhone)
      .in("status", ACTIVE_BOOKING_STATUSES);

    if (activeBookingsError) {
      return new Response(JSON.stringify({ error: activeBookingsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const activeBookingRows = activeBookings || [];
    if (activeBookingRows.length >= MAX_ACTIVE_BOOKINGS) {
      return new Response(JSON.stringify({ error: "active_limit", message: msg.activeLimit }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const remainingTargetSlots = MAX_ACTIVE_BOOKINGS - activeBookingRows.length;

    if (!Number.isFinite(customerLat) || !Number.isFinite(customerLng)) {
      const message = language === "en"
        ? "Please share your location first so we only search within 15 km."
        : "يرجى تحديد موقعك أولاً حتى نبحث ضمن نطاق 15 كم فقط.";
      return new Response(JSON.stringify({ error: "location_required", message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: stations }, { data: services }, settings, ownerInfoMap] = await Promise.all([
      supabase
        .from("stations")
        .select("id,name,latitude,longitude,is_active")
        .eq("is_active", true)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .order("name", { ascending: true }),
      supabase
        .from("services")
        .select("id,station_id,name,is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      getSettings(supabase),
      getStationOwnerInfoMap(supabase),
    ]);

    const stationRows = (stations || []) as StationRow[];
    const serviceRows = (services || []) as ServiceRow[];
    const baseLat = customerLat;
    const baseLng = customerLng;
    const { data: previousQuickRequests } = await supabase
      .from("quick_booking_requests")
      .select("quick_booking_targets(station_id)")
      .eq("customer_phone", customerPhone)
      .eq("status", "pending");
    const previousStationIds = new Set<string>();
    for (const request of previousQuickRequests || []) {
      const targets = Array.isArray((request as any).quick_booking_targets)
        ? (request as any).quick_booking_targets
        : [];
      for (const target of targets) {
        const stationId = String(target?.station_id || "");
        if (stationId) previousStationIds.add(stationId);
      }
    }

    const skippedStations: { station_id: string; station_name: string; reason: string }[] = [];
    const excludedStationIds = new Set<string>(
      Array.isArray(body.exclude_station_ids)
        ? body.exclude_station_ids.map((v: unknown) => String(v || "")).filter(Boolean)
        : [],
    );
    for (const stationId of previousStationIds) {
      excludedStationIds.add(stationId);
    }
    for (const booking of activeBookingRows) {
      const stationId = String((booking as any)?.station_id || "");
      if (stationId) excludedStationIds.add(stationId);
    }
    const ranked = stationRows
      .map((station) => {
        if (excludedStationIds.has(station.id)) {
          skippedStations.push({ station_id: station.id, station_name: station.name, reason: "excluded_station" });
          return null;
        }
        const ownerInfo = ownerInfoMap.get(station.id);
        if (!ownerInfo?.userId) {
          skippedStations.push({ station_id: station.id, station_name: station.name, reason: "missing_owner_account" });
          return null;
        }
        if (!ownerInfo.ownerActive) {
          skippedStations.push({ station_id: station.id, station_name: station.name, reason: "owner_inactive" });
          return null;
        }
        const stationServices = serviceRows.filter((svc) => svc.is_active && svc.station_id === station.id);
        const selectedService = serviceFilterName
          ? stationServices.find((svc) => matchesServiceName(svc.name, serviceFilterName))
          : stationServices[0];
        if (!selectedService) {
          skippedStations.push({ station_id: station.id, station_name: station.name, reason: "service_mismatch_or_missing" });
          return null;
        }
        if (station.latitude === null || station.longitude === null) {
          skippedStations.push({ station_id: station.id, station_name: station.name, reason: "missing_location" });
          return null;
        }
        const distance = haversineDistance(baseLat, baseLng, station.latitude, station.longitude);
        if (distance > QUICK_BOOKING_RADIUS_KM) {
          skippedStations.push({ station_id: station.id, station_name: station.name, reason: "outside_15km_radius" });
          return null;
        }
        return {
          station,
          service: selectedService,
          ownerPhone: ownerInfo.ownerPhone,
          ownerUserId: ownerInfo.userId,
          distance,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const distanceDelta = a.distance - b.distance;
        if (Math.abs(distanceDelta) > 0.000001) return distanceDelta;
        const nameDelta = String(a.station.name || "").localeCompare(String(b.station.name || ""), "ar");
        if (nameDelta !== 0) return nameDelta;
        return String(a.station.id || "").localeCompare(String(b.station.id || ""));
      }) as {
        station: StationRow; service: ServiceRow; distance: number; ownerPhone: string; ownerUserId: string | null
      }[];

    const matched = ranked;

    if (matched.length === 0) {
      return new Response(JSON.stringify({ error: "no_station_found", message: msg.noStations }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let requestRow: { id: string } | null = null;
    const requestPayload = {
      customer_name: customerName,
      customer_phone: customerPhone,
      service_kind: serviceFilterName || "quick",
      language,
      booking_date: bookingDate,
      booking_time: bookingTime,
      customer_lat: baseLat,
      customer_lng: baseLng,
      status: "pending",
    };

    const requestInsert = await supabase
      .from("quick_booking_requests")
      .insert(requestPayload)
      .select("id")
      .single();

    if (requestInsert.error && requestInsert.error.message.includes("language")) {
      const { language: _legacyIgnore, ...legacyRequestPayload } = requestPayload;
      const legacyInsert = await supabase
        .from("quick_booking_requests")
        .insert(legacyRequestPayload)
        .select("id")
        .single();
      requestRow = legacyInsert.data || null;
    } else {
      requestRow = requestInsert.data || null;
    }

    const bookingRows: { station_id: string; booking_id: string; booking_number: number; station_name: string; distance_km: number }[] = [];

    for (const item of matched) {
      if (bookingRows.length >= remainingTargetSlots) break;

      const quotaResult = await consumeStationRequestQuota({
        supabase,
        settings,
        stationId: item.station.id,
      });

      if (!quotaResult.allowed) {
        skippedStations.push({
          station_id: item.station.id,
          station_name: item.station.name,
          reason: quotaResult.reason,
        });
        continue;
      }

      const bookingPayload = {
        customer_name: customerName,
        customer_phone: customerPhone,
        station_id: item.station.id,
        service_id: item.service.id,
        booking_date: bookingDate,
        booking_time: bookingTime,
        booking_language: language,
        status: "pending",
      };

      let booking: { id: string; booking_number: number } | null = null;
      const bookingInsert = await supabase
        .from("bookings")
        .insert(bookingPayload)
        .select("id, booking_number")
        .single();

      if (bookingInsert.error && bookingInsert.error.message.includes("booking_language")) {
        const { booking_language: _legacyIgnore, ...legacyBookingPayload } = bookingPayload;
        const legacyInsert = await supabase
          .from("bookings")
          .insert(legacyBookingPayload)
          .select("id, booking_number")
          .single();
        booking = legacyInsert.data || null;
      } else {
        booking = bookingInsert.data || null;
      }

      if (!booking) continue;

      bookingRows.push({
        station_id: item.station.id,
        booking_id: booking.id,
        booking_number: booking.booking_number,
        station_name: item.station.name,
        distance_km: Number(item.distance.toFixed(2)),
      });

      await supabase.from("quick_booking_targets").insert({
        request_id: requestRow?.id || null,
        station_id: item.station.id,
        booking_id: booking.id,
        distance_km: Number(item.distance.toFixed(2)),
        state: "pending",
      });

      const inboxBody =
        language === "en"
          ? `${item.station.name} - ${Number(item.distance.toFixed(2))} km - pending station approval - #${booking.booking_number}`
          : `${item.station.name} - ${Number(item.distance.toFixed(2))} كم - بانتظار موافقة المحطة - #${booking.booking_number}`;
      await supabase.from("customer_notifications").insert({
        customer_phone: customerPhone,
        title: msg.requestSent,
        body: inboxBody,
        reference_booking_id: booking.id,
      });

      if (item.ownerUserId) {
        await supabase.from("notifications").insert({
          user_id: item.ownerUserId,
          title: msg.ownerTitle,
          body: `${customerName} - ${item.service.name} - ${bookingDate} ${bookingTime} - #${booking.booking_number}`,
          type: "booking",
          reference_id: booking.id,
        });
      }

    }

    if (bookingRows.length === 0) {
      return new Response(JSON.stringify({ error: "no_quota_available", message: msg.noStations, skipped: skippedStations }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        request_id: requestRow?.id || null,
        targets: bookingRows,
        target_count: bookingRows.length,
        skipped: skippedStations,
        message: msg.requestSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
