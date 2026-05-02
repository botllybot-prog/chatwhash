import { createClient } from "npm:@supabase/supabase-js@2";

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
type ServiceKind = "surface" | "jack";

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
    services: Record<ServiceKind, string>;
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
    activeLimit: "You can keep up to 2 active bookings. Cancel an older one first.",
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
    activeLimit: "En fazla 2 aktif rezervasyonunuz olabilir. Önce eski bir rezervasyonu iptal edin.",
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

function serviceMatches(name: string, kind: ServiceKind): boolean {
  const normalized = name.toLowerCase();
  if (kind === "jack") return normalized.includes("جك") || normalized.includes("jack") || normalized.includes("kriko");
  return normalized.includes("سطحي") || normalized.includes("surface") || normalized.includes("yüzey");
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

async function sendWhatsAppInteractive(
  to: string,
  body: string,
  buttons: { id: string; title: string }[],
  settings: Record<string, string>,
) {
  const token = settings.WHATSAPP_ACCESS_TOKEN;
  const phoneId = settings.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return null;

  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: body },
        action: {
          buttons: buttons.map((b) => ({
            type: "reply",
            reply: { id: b.id, title: b.title },
          })),
        },
      },
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data?.messages?.[0]?.id ?? null;
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

    const { data: duplicateAtSameTime } = await supabase
      .from("bookings")
      .select("id")
      .eq("customer_phone", customerPhone)
      .eq("booking_date", bookingDate)
      .eq("booking_time", bookingTime)
      .in("status", ["pending", "confirmed"])
      .limit(1);

    if (duplicateAtSameTime && duplicateAtSameTime.length > 0) {
      return new Response(JSON.stringify({ error: "already_booked_same_time", message: msg.duplicateSameTime }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: activeBookings } = await supabase
      .from("bookings")
      .select("id")
      .eq("customer_phone", customerPhone)
      .in("status", ["pending", "confirmed"])
      .limit(2);

    if ((activeBookings?.length || 0) >= 2) {
      return new Response(JSON.stringify({ error: "active_bookings_limit", message: msg.activeLimit }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: stations }, { data: services }, settings] = await Promise.all([
      supabase
        .from("stations")
        .select("id,name,latitude,longitude,is_active")
        .eq("is_active", true)
        .not("latitude", "is", null)
        .not("longitude", "is", null),
      supabase.from("services").select("id,station_id,name,is_active").eq("is_active", true),
      getSettings(supabase),
    ]);

    const stationRows = (stations || []) as StationRow[];
    const serviceRows = (services || []) as ServiceRow[];
    const fallbackLat = 36.34;
    const fallbackLng = 43.13;
    const baseLat = Number.isFinite(customerLat) ? customerLat : fallbackLat;
    const baseLng = Number.isFinite(customerLng) ? customerLng : fallbackLng;

    const matched = stationRows
      .map((station) => {
        const stationServices = serviceRows.filter(
          (svc) => svc.is_active && svc.station_id === station.id && serviceMatches(svc.name, serviceKind),
        );
        const firstService = stationServices[0];
        if (!firstService || station.latitude === null || station.longitude === null) return null;
        return {
          station,
          service: firstService,
          distance: haversineDistance(baseLat, baseLng, station.latitude, station.longitude),
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.distance - b.distance)
      .slice(0, 3) as { station: StationRow; service: ServiceRow; distance: number }[];

    if (matched.length === 0) {
      return new Response(JSON.stringify({ error: "no_station_found", message: msg.noStations }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: requestRow } = await supabase
      .from("quick_booking_requests")
      .insert({
        customer_name: customerName,
        customer_phone: customerPhone,
        service_kind: serviceKind,
        language,
        booking_date: bookingDate,
        booking_time: bookingTime,
        customer_lat: baseLat,
        customer_lng: baseLng,
        status: "pending",
      })
      .select("id")
      .single();

    const bookingRows: { station_id: string; booking_id: string; station_name: string }[] = [];

    for (const item of matched) {
      const { data: booking } = await supabase
        .from("bookings")
        .insert({
          customer_name: customerName,
          customer_phone: customerPhone,
          station_id: item.station.id,
          service_id: item.service.id,
          booking_date: bookingDate,
          booking_time: bookingTime,
          booking_language: language,
          status: "pending",
        })
        .select("id, booking_number")
        .single();

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

      const { data: owner } = await supabase
        .from("station_owners")
        .select("owner_phone, owner_name")
        .eq("station_id", item.station.id)
        .maybeSingle();

      if (owner?.owner_phone) {
        const ownerPhone = normalizePhone(owner.owner_phone);
        const ownerText =
          `📢 ${msg.ownerTitle}\n\n` +
          `👤 ${msg.customer}: ${customerName}\n` +
          `📱 ${msg.phone}: ${customerPhone}\n` +
          `🔧 ${msg.service}: ${msg.services[serviceKind]}\n` +
          `📅 ${msg.date}: ${bookingDate}\n` +
          `🕐 ${msg.time}: ${bookingTime}\n` +
          `🏷️ ${msg.bookingNo}: #${booking.booking_number ?? "---"}\n\n` +
          `${msg.ownerHint}`;

        await sendWhatsAppInteractive(
          ownerPhone,
          ownerText,
          [
            { id: "approve_yes", title: msg.approve },
            { id: "approve_no", title: msg.reject },
            { id: `change_time_${booking.id}`, title: msg.changeTime },
          ],
          settings,
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

    return new Response(
      JSON.stringify({
        success: true,
        request_id: requestRow?.id || null,
        targets: bookingRows,
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
