import { createClient } from "npm:@supabase/supabase-js@2";
import { sendWhatsAppTextReliable } from "../_shared/whatsapp-reliable.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned;
}

function formatTime(time: string | null) {
  return time ? time.substring(0, 5) : "بدون وقت محدد";
}

async function getSettings(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase.from("app_settings").select("key, value");
  const settings: Record<string, string> = {};

  for (const row of data || []) {
    settings[row.key] = row.value;
  }

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
    console.error("[cancel-map-booking] WhatsApp send failed:", result.error);
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
    const bookingId = (body.booking_id as string | undefined)?.trim();
    const customerPhone = normalizePhone((body.customer_phone as string | undefined)?.trim() || "");

    if (!bookingId || !customerPhone) {
      return new Response(JSON.stringify({ error: "بيانات الإلغاء غير مكتملة." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        id,
        booking_number,
        customer_name,
        customer_phone,
        booking_date,
        booking_time,
        booking_language,
        status,
        station_id,
        spin_discount_percent,
        stations(name),
        services(name)
      `)
      .eq("id", bookingId)
      .eq("customer_phone", customerPhone)
      .maybeSingle();

    if (bookingError) {
      return new Response(JSON.stringify({ error: bookingError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!booking) {
      return new Response(JSON.stringify({ error: "لم يتم العثور على الحجز المطلوب لهذا الرقم." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (booking.status === "cancelled") {
      return new Response(JSON.stringify({ success: true, alreadyCancelled: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["pending", "confirmed", "pending_customer_approval"].includes(booking.status)) {
      return new Response(JSON.stringify({ error: "لا يمكن إلغاء هذا الحجز في حالته الحالية." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [settings, ownerResult, adminResult] = await Promise.all([
      getSettings(supabase),
      supabase
        .from("station_owners")
        .select("user_id, owner_phone")
        .eq("station_id", booking.station_id)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1)
        .maybeSingle(),
    ]);

    const dateLabel = new Date(booking.booking_date).toLocaleDateString("ar-IQ", {
      calendar: "gregory",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const stationName = (booking.stations as { name?: string } | null)?.name || "";
    const serviceName = (booking.services as { name?: string } | null)?.name || "";
    const customerName = booking.customer_name || customerPhone;

    const customerCancelMsg = `تم إلغاء الحجز #${booking.booking_number} بناءً على طلبك من الخريطة. ✅\n\n🏪 المحطة: ${stationName}\n🔧 الخدمة: ${serviceName}\n🎯 الخصم: (${booking.spin_discount_percent || 0})%\n📅 التاريخ: ${dateLabel}\n⏰ الوقت: ${formatTime(booking.booking_time)}\n\nيمكنك الآن إنشاء حجز جديد إذا رغبت.`;
    await sendWhatsAppMessage(customerPhone, customerCancelMsg, settings, booking.booking_language || "ar");

    if (ownerResult.data?.owner_phone) {
      const ownerPhone = normalizePhone(ownerResult.data.owner_phone);
      const ownerCancelMsg = `⚠️ الزبون قام بإلغاء الحجز.\n\n📋 رقم الحجز: #${booking.booking_number}\n👤 العميل: ${customerName}\n🏪 المحطة: ${stationName}\n🔧 الخدمة: ${serviceName}\n🎯 الخصم: (${booking.spin_discount_percent || 0})%\n📅 التاريخ: ${dateLabel}\n🕐 الوقت: ${formatTime(booking.booking_time)}`;
      await sendWhatsAppMessage(ownerPhone, ownerCancelMsg, settings, booking.booking_language || "ar");
    }

    if (ownerResult.data?.user_id) {
      await supabase.from("notifications").insert({
        user_id: ownerResult.data.user_id,
        title: "تم إلغاء حجز من الخريطة",
        body: `الحجز #${booking.booking_number} أُلغي من قبل العميل.`,
        type: "booking",
        reference_id: booking.id,
      });
    }

    if (adminResult.data?.user_id) {
      await supabase.from("notifications").insert({
        user_id: adminResult.data.user_id,
        title: "تم إلغاء حجز من الخريطة",
        body: `الحجز #${booking.booking_number} أُلغي من قبل العميل ${customerName}.`,
        type: "booking",
        reference_id: booking.id,
      });
    }

    return new Response(JSON.stringify({ success: true, bookingNumber: booking.booking_number }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع.";

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
