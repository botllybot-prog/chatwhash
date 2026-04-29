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

function normalizePhone(phone: string): string {
  const cleaned = String(phone || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.slice(1)}`;
  return cleaned;
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
    const customerName = String(body.customer_name || "").trim();
    const customerPhone = normalizePhone(String(body.customer_phone || ""));
    const serviceKind = String(body.service_kind || "").trim();
    const bookingDate = String(body.booking_date || "").trim();
    const bookingTime = String(body.booking_time || "").trim();
    const customerLat = Number(body.customer_lat);
    const customerLng = Number(body.customer_lng);

    if (!customerName || !customerPhone || !serviceKind || !bookingDate || !bookingTime) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
      return new Response(
        JSON.stringify({ error: "already_booked_same_time", message: "لديك حجز سابق في نفس الموعد، يرجى إلغاؤه أولاً." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: activeBookings } = await supabase
      .from("bookings")
      .select("id")
      .eq("customer_phone", customerPhone)
      .in("status", ["pending", "confirmed"])
      .limit(2);

    if ((activeBookings?.length || 0) >= 2) {
      return new Response(
        JSON.stringify({
          error: "active_bookings_limit",
          message: "يمكنك امتلاك حجزين نشطين كحد أقصى. ألغِ حجزًا قديمًا أولاً.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const [{ data: stations }, { data: services }, settings] = await Promise.all([
      supabase
        .from("stations")
        .select("id,name,latitude,longitude,is_active")
        .eq("is_active", true)
        .not("latitude", "is", null)
        .not("longitude", "is", null),
      supabase
        .from("services")
        .select("id,station_id,name,is_active")
        .eq("is_active", true),
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
          (svc) =>
            svc.is_active &&
            svc.station_id === station.id &&
            svc.name.toLowerCase().includes(serviceKind.toLowerCase()),
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
      return new Response(
        JSON.stringify({
          error: "no_station_found",
          message: "لا توجد محطات متاحة حالياً لهذا النوع من الخدمة.",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: requestRow } = await supabase
      .from("quick_booking_requests")
      .insert({
        customer_name: customerName,
        customer_phone: customerPhone,
        service_kind: serviceKind,
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
        const msg =
          `📢 طلب حجز سريع جديد\n\n` +
          `👤 العميل: ${customerName}\n` +
          `📱 الهاتف: ${customerPhone}\n` +
          `🔧 الخدمة: ${serviceKind}\n` +
          `📅 التاريخ: ${bookingDate}\n` +
          `🕐 الوقت: ${bookingTime}\n` +
          `🏷️ رقم الحجز: #${booking.booking_number ?? "---"}\n\n` +
          `الرد الأسرع يحصل على الحجز.`;

        await sendWhatsAppInteractive(
          ownerPhone,
          msg,
          [
            { id: "approve_yes", title: "✅ تأكيد" },
            { id: "approve_no", title: "❌ رفض" },
            { id: `change_time_${booking.id}`, title: "📅 تغيير الموعد" },
          ],
          settings,
        );

        await supabase
          .from("bot_sessions")
          .upsert(
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
        message: "تم إرسال طلب الحجز السريع لأقرب 3 محطات.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

