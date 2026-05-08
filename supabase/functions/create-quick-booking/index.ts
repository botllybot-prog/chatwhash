import { createClient } from "npm:@supabase/supabase-js@2";
import { consumeStationRequestQuota } from "../_shared/request-packages.ts";
import { sendWhatsAppInteractiveReliable, sendWhatsAppTextReliable } from "../_shared/whatsapp-reliable.ts";

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
    activeLimit: "يمكنك امتلاك حجزين نشطين كحد أقصى. ألغِ حجزاً قديماً أولاً.",
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
    activeLimit: "زۆرترین دوو حجزی چالاک دەتوانیت هەبێت. سەرەتا یەکێکی کۆن هەڵبوەشێنەوە.",
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

type OwnerStationInfo = { ownerPhone: string; ownerActive: boolean };

async function getStationOwnerInfoMap(supabase: any): Promise<Map<string, OwnerStationInfo>> {
  const { data } = await supabase
    .from("station_owners")
    .select("station_id, owner_phone, is_active, created_at")
    .not("owner_phone", "is", null);

  const ownerMap = new Map<string, OwnerStationInfo>();
  const sortedRows = [...(data || [])].sort((a: any, b: any) => {
    const aCreated = new Date(String(a?.created_at || 0)).getTime();
    const bCreated = new Date(String(b?.created_at || 0)).getTime();
    return bCreated - aCreated;
  });

  for (const row of sortedRows) {
    const stationId = String(row.station_id || "");
    const ownerPhone = normalizePhone(String(row.owner_phone || ""));
    const ownerActive = row.is_active !== false;
    if (!stationId || !ownerPhone) continue;
    // Keep the newest owner row per station only.
    // This ensures "suspended/paused" latest state is respected.
    if (!ownerMap.has(stationId)) {
      ownerMap.set(stationId, { ownerPhone, ownerActive });
    }
  }
  return ownerMap;
}

async function sendWhatsAppInteractive(
  to: string,
  body: string,
  buttons: { id: string; title: string }[],
  settings: Record<string, string>,
  language?: Language,
) {
  try {
    const result = await sendWhatsAppInteractiveReliable({
      phone: to,
      body,
      buttons,
      settings,
      language,
    });

    if (!result.ok) {
      console.error("[create-quick-booking] WhatsApp interactive send failed:", result.error);
    }

    return result.messageId;
  } catch (error) {
    console.error("[create-quick-booking] WhatsApp interactive send crashed:", error);
    return null;
  }
}

async function sendWhatsAppText(
  to: string,
  body: string,
  settings: Record<string, string>,
  language?: Language,
) {
  try {
    const result = await sendWhatsAppTextReliable({
      phone: to,
      message: body,
      settings,
      language,
    });

    if (!result.ok) {
      console.error("[create-quick-booking] WhatsApp text send failed:", result.error);
    }

    return result.messageId;
  } catch (error) {
    console.error("[create-quick-booking] WhatsApp text send crashed:", error);
    return null;
  }
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
    const quickBookingAlreadyPendingMessage =
      language === "en"
        ? "You already have a quick booking waiting for a response. You cannot create another booking right now. Please wait 10 minutes; if the first 3 stations do not answer, we will send your request to 3 farther stations within your current area."
        : language === "tr"
          ? "Zaten yanıt bekleyen bir hızlı rezervasyonunuz var. Şu anda tekrar rezervasyon oluşturamazsınız. Lütfen 10 dakika bekleyin; ilk 3 istasyon yanıt vermezse talebinizi mevcut bölgeniz içindeki 3 daha uzak istasyona göndereceğiz."
          : language === "ku"
            ? "پێشتر حجزێکی خێرات هەیە و چاوەڕێی وەڵامە. ئێستا ناتوانیت حجزێکی تر بکەیت. تکایە 10 خولەک چاوەڕێ بکە؛ ئەگەر یەکەم 3 وێستگە وەڵامیان نەدا، داواکارییەکەت بۆ 3 وێستگەی دوورتر لە ناوچەی ئێستات دەنێرین."
            : "لقد قمت بحجز سريع وبانتظار الرد. لا يمكنك إجراء حجز مرة أخرى، رجاءً انتظر 10 دقائق. في حالة لم تتم الإجابة من قبل أول 3 محطات سنرسل طلبك إلى 3 محطات أبعد ضمن نطاقك الحالي.";

    const customerName = String(body.customer_name || "").trim();
    const customerPhone = normalizePhone(String(body.customer_phone || ""));
    const serviceKind = normalizeServiceKind(String(body.service_kind || ""));
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

    if (!Number.isFinite(customerLat) || !Number.isFinite(customerLng)) {
      const message = language === "en"
        ? "Please share your location first so we only search within 15 km."
        : "يرجى تحديد موقعك أولاً حتى نبحث ضمن نطاق 15 كم فقط.";
      return new Response(JSON.stringify({ error: "location_required", message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: duplicateAtSameTime } = await supabase
      .from("bookings")
      .select("id")
      .eq("customer_phone", customerPhone)
      .eq("booking_date", bookingDate)
      .eq("booking_time", bookingTime)
      .in("status", ["pending", "confirmed"])
      .limit(1);

    if (duplicateAtSameTime && duplicateAtSameTime.length > 0) {
      return new Response(JSON.stringify({ error: "quick_booking_already_pending", message: quickBookingAlreadyPendingMessage }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: activeBookings } = await supabase
      .from("bookings")
      .select("id")
      .eq("customer_phone", customerPhone)
      .in("status", ["pending", "confirmed"])
      .limit(3);

    if ((activeBookings?.length || 0) >= 3) {
      return new Response(JSON.stringify({ error: "quick_booking_already_pending", message: quickBookingAlreadyPendingMessage }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: stations }, { data: services }, settings, ownerInfoMap] = await Promise.all([
      supabase
        .from("stations")
        .select("id,name,latitude,longitude,is_active")
        .eq("is_active", true)
        .not("latitude", "is", null)
        .not("longitude", "is", null),
      supabase.from("services").select("id,station_id,name,is_active").eq("is_active", true),
      getSettings(supabase),
      getStationOwnerInfoMap(supabase),
    ]);

    const stationRows = (stations || []) as StationRow[];
    const serviceRows = (services || []) as ServiceRow[];
    const baseLat = customerLat;
    const baseLng = customerLng;

    const skippedStations: { station_id: string; station_name: string; reason: string }[] = [];
    const excludedStationIds = new Set<string>(
      Array.isArray(body.exclude_station_ids)
        ? body.exclude_station_ids.map((v: unknown) => String(v || "")).filter(Boolean)
        : [],
    );
    const ranked = stationRows
      .map((station) => {
        if (excludedStationIds.has(station.id)) {
          skippedStations.push({ station_id: station.id, station_name: station.name, reason: "excluded_station" });
          return null;
        }
        const ownerInfo = ownerInfoMap.get(station.id);
        if (!ownerInfo?.ownerPhone) {
          skippedStations.push({ station_id: station.id, station_name: station.name, reason: "missing_owner_phone" });
          return null;
        }
        if (!ownerInfo.ownerActive) {
          skippedStations.push({ station_id: station.id, station_name: station.name, reason: "owner_inactive" });
          return null;
        }
        const stationServices = serviceRows.filter((svc) => svc.is_active && svc.station_id === station.id);
        const firstService = stationServices[0];
        if (!firstService) {
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
          service: firstService,
          ownerPhone: ownerInfo.ownerPhone,
          distance,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.distance - b.distance) as {
        station: StationRow; service: ServiceRow; distance: number; ownerPhone: string
      }[];

    const matched = ranked;

    if (matched.length === 0) {
      return new Response(JSON.stringify({ error: "no_station_found", message: msg.noStations }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let requestRow: { id: string } | null = null;
    const requestPayload = {
      customer_name: customerName,
      customer_phone: customerPhone,
      service_kind: serviceKind,
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

    const bookingRows: { station_id: string; booking_id: string; station_name: string }[] = [];

    for (const item of matched) {
      if (bookingRows.length >= 3) break;

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
        station_name: item.station.name,
      });

      await supabase.from("quick_booking_targets").insert({
        request_id: requestRow?.id || null,
        station_id: item.station.id,
        booking_id: booking.id,
        distance_km: Number(item.distance.toFixed(2)),
        state: "pending",
      });

      if (item.ownerPhone) {
        const ownerPhone = item.ownerPhone;
        const ownerText =
          `📢 ${msg.ownerTitle}\n\n` +
          `👤 ${msg.customer}: ${customerName}\n` +
          `📱 ${msg.phone}: ${customerPhone}\n` +
          `🔧 ${msg.service}: ${item.service.name}\n` +
          `📅 ${msg.date}: ${bookingDate}\n` +
          `🕐 ${msg.time}: ${bookingTime}\n` +
          `🏷️ ${msg.bookingNo}: #${booking.booking_number ?? "---"}\n\n` +
          `${msg.ownerHint}`;

        await sendWhatsAppInteractive(
          ownerPhone,
          ownerText,
          [
            { id: `approve_yes_${booking.id}`, title: msg.approve },
            { id: `approve_no_${booking.id}`, title: msg.reject },
            { id: `change_time_${booking.id}`, title: msg.changeTime },
          ],
          settings,
          language,
        );

        await supabase.from("bot_sessions").upsert(
          {
            customer_phone: ownerPhone,
            current_step: "owner_approve_reject",
            pending_booking_id: booking.id,
            selected_station_id: item.station.id,
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "customer_phone" },
        );
      }
    }

    if (bookingRows.length === 0) {
      return new Response(JSON.stringify({ error: "no_quota_available", message: msg.noStations, skipped: skippedStations }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const waitingOwnerReply =
      language === "en"
        ? "Your request was sent to 3 stations and we are waiting for the first response. We will notify you if none of the stations reply, then send your request to 3 other stations within 15 km."
        : language === "tr"
          ? "Talebiniz 3 istasyona gönderildi ve yanıt bekleniyor. Hiçbir istasyon yanıt vermezse sizi bilgilendirip talebinizi 15 km içindeki 3 başka istasyona göndereceğiz."
          : language === "ku"
            ? "داواکارییەکەت بۆ 3 وێستگە نێردرا و چاوەڕێی وەڵام دەکەین. ئەگەر هیچ وێستگەیەک وەڵامی نەداوە، ئاگادارت دەکەین و داواکارییەکەت بۆ 3 وێستگەی تری ناو 15 کم دەنێرین."
            : "تم إرسال طلبك إلى 3 محطات وبانتظار الرد. سنعلمك في حالة لم يجب أحد المحطات ونرسل طلبك إلى 3 محطات أخرى ضمن نطاق 15 كلم.";

    await sendWhatsAppInteractive(
      customerPhone,
      waitingOwnerReply,
      [
        { id: "quick_targets", title: "المحطات الحالية" },
        { id: "quick_cancel_all", title: "إلغاء الحجوزات" },
        { id: "quick_map", title: "العودة للخريطة" },
      ],
      settings,
      language,
    );

    await supabase.from("bot_sessions").upsert(
      {
        customer_phone: customerPhone,
        current_step: "quick_booking_waiting",
        timeout_request_id: requestRow?.id || null,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "customer_phone" },
    );

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
