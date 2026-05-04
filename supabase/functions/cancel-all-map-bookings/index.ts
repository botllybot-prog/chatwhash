import { createClient } from "npm:@supabase/supabase-js@2";
import { sendWhatsAppTextReliable } from "../_shared/whatsapp-reliable.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Language = "ar" | "en" | "ku" | "tr";

const i18n: Record<
  Language,
  {
    dateLocale: string;
    notSpecified: string;
    stationFallback: string;
    serviceFallback: string;
    customerCancelled: (
      bookingNo: string | number,
      station: string,
      service: string,
      date: string,
      time: string
    ) => string;
    ownerCancelled: (
      bookingNo: string | number,
      customer: string,
      station: string,
      service: string,
      date: string,
      time: string
    ) => string;
  }
> = {
  ar: {
    dateLocale: "ar-IQ",
    notSpecified: "غير محدد",
    stationFallback: "المحطة",
    serviceFallback: "الخدمة",
    customerCancelled: (bookingNo, station, service, date, time) =>
      `تم إلغاء الحجز #${bookingNo} بنجاح. ✅\n\n🏪 المحطة: ${station}\n🔧 الخدمة: ${service}\n📅 التاريخ: ${date}\n⏰ الوقت: ${time}`,
    ownerCancelled: (bookingNo, customer, station, service, date, time) =>
      `⚠️ الزبون قام بإلغاء الحجز.\n\n📋 رقم الحجز: #${bookingNo}\n👤 الزبون: ${customer}\n🏪 المحطة: ${station}\n🔧 الخدمة: ${service}\n📅 التاريخ: ${date}\n⏰ الوقت: ${time}`,
  },
  en: {
    dateLocale: "en-US",
    notSpecified: "Not specified",
    stationFallback: "Station",
    serviceFallback: "Service",
    customerCancelled: (bookingNo, station, service, date, time) =>
      `Booking #${bookingNo} has been cancelled successfully. ✅\n\n🏪 Station: ${station}\n🔧 Service: ${service}\n📅 Date: ${date}\n⏰ Time: ${time}`,
    ownerCancelled: (bookingNo, customer, station, service, date, time) =>
      `⚠️ Customer cancelled the booking.\n\n📋 Booking #: #${bookingNo}\n👤 Customer: ${customer}\n🏪 Station: ${station}\n🔧 Service: ${service}\n📅 Date: ${date}\n⏰ Time: ${time}`,
  },
  ku: {
    dateLocale: "ckb-IQ",
    notSpecified: "دیاری نەکراوە",
    stationFallback: "وێستگە",
    serviceFallback: "خزمەتگوزاری",
    customerCancelled: (bookingNo, station, service, date, time) =>
      `حجز #${bookingNo} بە سەرکەوتوویی هەڵوەشێندرایەوە. ✅\n\n🏪 وێستگە: ${station}\n🔧 خزمەتگوزاری: ${service}\n📅 بەروار: ${date}\n⏰ کات: ${time}`,
    ownerCancelled: (bookingNo, customer, station, service, date, time) =>
      `⚠️ کڕیار حجزەکەی هەڵوەشاندەوە.\n\n📋 ژمارەی حجز: #${bookingNo}\n👤 کڕیار: ${customer}\n🏪 وێستگە: ${station}\n🔧 خزمەتگوزاری: ${service}\n📅 بەروار: ${date}\n⏰ کات: ${time}`,
  },
  tr: {
    dateLocale: "tr-TR",
    notSpecified: "Belirtilmedi",
    stationFallback: "İstasyon",
    serviceFallback: "Hizmet",
    customerCancelled: (bookingNo, station, service, date, time) =>
      `Rezervasyon #${bookingNo} başarıyla iptal edildi. ✅\n\n🏪 İstasyon: ${station}\n🔧 Hizmet: ${service}\n📅 Tarih: ${date}\n⏰ Saat: ${time}`,
    ownerCancelled: (bookingNo, customer, station, service, date, time) =>
      `⚠️ Müşteri rezervasyonu iptal etti.\n\n📋 Rezervasyon #: #${bookingNo}\n👤 Müşteri: ${customer}\n🏪 İstasyon: ${station}\n🔧 Hizmet: ${service}\n📅 Tarih: ${date}\n⏰ Saat: ${time}`,
  },
};

function normalizePhone(phone: string): string {
  const cleaned = String(phone || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned;
}

function normalizeLanguage(value: unknown): Language {
  if (value === "ar" || value === "en" || value === "ku" || value === "tr") return value;
  return "ar";
}

function to12Hour(time: string | null | undefined, language: Language): string {
  const tt = i18n[language];
  if (!time) return tt.notSpecified;
  const [hRaw, mRaw] = time.substring(0, 5).split(":").map(Number);
  const h = Number.isFinite(hRaw) ? hRaw : 0;
  const m = Number.isFinite(mRaw) ? mRaw : 0;
  const pm = h >= 12;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  if (language === "en") return `${hour12}:${String(m).padStart(2, "0")} ${pm ? "PM" : "AM"}`;
  if (language === "tr") return `${hour12}:${String(m).padStart(2, "0")} ${pm ? "ÖS" : "ÖÖ"}`;
  if (language === "ku") return `${hour12}:${String(m).padStart(2, "0")} ${pm ? "ئێوارە" : "بەیانی"}`;
  return `${hour12}:${String(m).padStart(2, "0")} ${pm ? "مساءً" : "صباحاً"}`;
}

async function getSettings(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase.from("app_settings").select("key, value");
  const settings: Record<string, string> = {};
  for (const row of data || []) settings[row.key] = row.value;
  return settings;
}

async function sendWhatsAppMessage(
  phone: string,
  message: string,
  settings: Record<string, string>,
  language?: string,
) {
  const result = await sendWhatsAppTextReliable({
    phone,
    message,
    settings,
    language,
  });

  if (!result.ok) {
    console.error("[cancel-all-map-bookings] WhatsApp send failed:", result.error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const customerPhone = normalizePhone(String(body.customer_phone || "").trim());
    if (!customerPhone) {
      return new Response(JSON.stringify({ error: "customer_phone is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let bookings: any[] = [];
    const withLanguage = await supabase
      .from("bookings")
      .select(
        "id,booking_number,customer_name,customer_phone,booking_date,booking_time,status,station_id,service_id,booking_language,stations(name),services(name)"
      )
      .eq("customer_phone", customerPhone)
      .in("status", ["pending", "confirmed", "pending_customer_approval"]);

    if (withLanguage.error) {
      const withoutLanguage = await supabase
        .from("bookings")
        .select(
          "id,booking_number,customer_name,customer_phone,booking_date,booking_time,status,station_id,service_id,stations(name),services(name)"
        )
        .eq("customer_phone", customerPhone)
        .in("status", ["pending", "confirmed", "pending_customer_approval"]);

      if (withoutLanguage.error) {
        return new Response(JSON.stringify({ error: withoutLanguage.error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      bookings = withoutLanguage.data || [];
    } else {
      bookings = withLanguage.data || [];
    }

    if (!bookings.length) {
      return new Response(JSON.stringify({ success: true, cancelledCount: 0, alreadyEmpty: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const settings = await getSettings(supabase);
    const bookingIds = bookings.map((row) => row.id);

    const { error: cancelError } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .in("id", bookingIds);

    if (cancelError) {
      return new Response(JSON.stringify({ error: cancelError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("quick_booking_requests")
      .update({ status: "cancelled" })
      .eq("customer_phone", customerPhone)
      .eq("status", "pending");

    const { data: targets } = await supabase
      .from("quick_booking_targets")
      .select("id")
      .in("booking_id", bookingIds)
      .eq("state", "pending");

    if (targets?.length) {
      await supabase
        .from("quick_booking_targets")
        .update({ state: "cancelled" })
        .in("id", targets.map((target) => target.id));
    }

    for (const booking of bookings) {
      const language = normalizeLanguage(booking.booking_language);
      const tt = i18n[language];
      const stationName = booking.stations?.name || tt.stationFallback;
      const serviceName = booking.services?.name || tt.serviceFallback;
      const customerName = booking.customer_name || customerPhone;
      const dateLabel = new Date(booking.booking_date).toLocaleDateString(tt.dateLocale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const timeLabel = to12Hour(booking.booking_time, language);

      await sendWhatsAppMessage(
        customerPhone,
        tt.customerCancelled(booking.booking_number, stationName, serviceName, dateLabel, timeLabel),
        settings,
        language,
      );

      const { data: owner } = await supabase
        .from("station_owners")
        .select("owner_phone")
        .eq("station_id", booking.station_id)
        .maybeSingle();

      if (owner?.owner_phone) {
        const ownerPhone = normalizePhone(owner.owner_phone);
        await sendWhatsAppMessage(
          ownerPhone,
          tt.ownerCancelled(booking.booking_number, customerName, stationName, serviceName, dateLabel, timeLabel),
          settings,
          language,
        );
      }
    }

    return new Response(JSON.stringify({ success: true, cancelledCount: bookings.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
