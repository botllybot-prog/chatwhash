import { createClient } from "npm:@supabase/supabase-js@2";
import { sendWhatsAppInteractiveReliable, sendWhatsAppTextReliable } from "../_shared/whatsapp-reliable.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendInteractive(
  phone: string,
  body: string,
  buttons: { id: string; title: string }[],
  settings: Record<string, string>,
) {
  const result = await sendWhatsAppInteractiveReliable({
    phone,
    body,
    buttons,
    settings,
    language: "ar",
  });
  return result.ok ? result.messageId : null;
}

async function sendText(
  phone: string,
  message: string,
  settings: Record<string, string>,
) {
  const result = await sendWhatsAppTextReliable({
    phone,
    message,
    settings,
    language: "ar",
  });
  return result.ok ? result.messageId : null;
}

function toTimestamp(date: string, time: string) {
  return new Date(`${date}T${time}Z`).getTime();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: settingsData } = await supabase.from("app_settings").select("key, value");
    const settings: Record<string, string> = {};
    for (const row of settingsData || []) settings[row.key] = row.value;

    const now = Date.now();

    // 1) Quick-booking timeout after 10 min: resend to the next stations within 15 km.
    const { data: timedOutBookings } = await supabase
      .from("quick_booking_requests")
      .select("id, created_at, customer_name, customer_phone, service_kind, booking_date, booking_time, customer_lat, customer_lng, language, quick_booking_targets(station_id, booking_id, bookings(booking_number, status, created_at, stations(name)))")
      .eq("status", "pending")
      .eq("timeout_notified", false)
      .limit(100);

    let timeoutAlerts = 0;
    for (const request of timedOutBookings || []) {
      const targets = Array.isArray((request as any).quick_booking_targets)
        ? (request as any).quick_booking_targets
        : [];
      const stationNames = targets
        .map((target: any) => target?.bookings?.stations?.name)
        .filter(Boolean)
        .slice(0, 3)
        .join("، ");
      const excludedStationIds = targets.map((target: any) => target?.station_id).filter(Boolean);
      const bookingIds = targets.map((target: any) => target?.booking_id).filter(Boolean);
      const targetBookings = targets.map((target: any) => target?.bookings).filter(Boolean);
      const hasAnsweredBooking = targetBookings.some((booking: any) =>
        booking?.status && booking.status !== "pending"
      );
      if (hasAnsweredBooking) {
        await supabase.from("quick_booking_requests").update({ status: "completed", timeout_notified: true }).eq("id", request.id);
        continue;
      }

      const firstSentAt = targetBookings
        .map((booking: any) => new Date(booking?.created_at || 0).getTime())
        .filter((value: number) => Number.isFinite(value) && value > 0)
        .sort((a: number, b: number) => a - b)[0] || new Date((request as any).created_at || 0).getTime();

      if (!Number.isFinite(firstSentAt) || firstSentAt > now - 10 * 60 * 1000) {
        continue;
      }

      if (bookingIds.length > 0) {
        await supabase.from("bookings").update({ status: "cancelled" }).in("id", bookingIds).eq("status", "pending");
        await supabase.from("quick_booking_targets").update({ state: "timed_out" }).in("booking_id", bookingIds);
      }

      await supabase.from("quick_booking_requests").update({ status: "timed_out", timeout_notified: true }).eq("id", request.id);

      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      let targetCount = 0;
      let resendOk = false;

      if (supabaseUrl && serviceKey) {
        const resendResponse = await fetch(`${supabaseUrl}/functions/v1/create-quick-booking`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customer_name: request.customer_name,
            customer_phone: request.customer_phone,
            service_kind: request.service_kind,
            booking_date: request.booking_date,
            booking_time: request.booking_time,
            customer_lat: request.customer_lat,
            customer_lng: request.customer_lng,
            language: request.language || "ar",
            exclude_station_ids: excludedStationIds,
          }),
        });
        const resendData = await resendResponse.json().catch(() => ({}));
        targetCount = Number(resendData?.target_count || 0);
        resendOk = resendResponse.ok && targetCount > 0;
      }

      const text = resendOk
        ? `⏰ لم يصل رد حتى الآن على طلبك${stationNames ? ` لدى ${stationNames}` : ""}.\nتمت إعادة إرسال الطلب إلى ${targetCount} محطة أخرى ضمن نطاق 15 كم، وبانتظار أسرع رد.`
        : `⏰ لم يصل رد حتى الآن على طلبك${stationNames ? ` لدى ${stationNames}` : ""}.\nلا توجد محطات أخرى متاحة ضمن نطاق 15 كم حالياً. يمكنك المحاولة لاحقاً أو اختيار حجز عادي من الخريطة.`;

      const sent = await sendText(request.customer_phone, text, settings);
      if (sent) timeoutAlerts++;
    }

    // 2) Send rating request one hour after booking time (for confirmed bookings).
    const { data: ratingCandidates } = await supabase
      .from("bookings")
      .select("id, booking_number, customer_phone, booking_date, booking_time, stations(name)")
      .eq("status", "confirmed")
      .eq("rating_requested", false)
      .not("booking_date", "is", null)
      .not("booking_time", "is", null);

    let ratingPrompts = 0;
    for (const booking of ratingCandidates || []) {
      const bookingAt = toTimestamp(String(booking.booking_date), String(booking.booking_time));
      if (!Number.isFinite(bookingAt)) continue;
      if (now < bookingAt + 60 * 60 * 1000) continue;

      const stationName = (booking.stations as any)?.name || "المحطة";
      const prompt =
        `⭐ كيف كانت تجربتك في ${stationName}؟\n` +
        `حجز رقم #${booking.booking_number}\n\n` +
        "أرسل رقم من 1 إلى 5 لتقييم الخدمة.";

      const sent = await sendText(
        booking.customer_phone,
        prompt,
        settings,
      );

      if (sent) {
        await Promise.all([
          supabase
            .from("bookings")
            .update({ rating_requested: true, rating_requested_at: new Date().toISOString() })
            .eq("id", booking.id),
          supabase
            .from("bot_sessions")
            .upsert({
              customer_phone: booking.customer_phone,
              current_step: "awaiting_rating",
              rating_booking_id: booking.id,
              updated_at: new Date().toISOString(),
              expires_at: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
            }, { onConflict: "customer_phone" }),
        ]);
        ratingPrompts++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        timeout_alerts: timeoutAlerts,
        rating_prompts: ratingPrompts,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[booking-reminders] error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
