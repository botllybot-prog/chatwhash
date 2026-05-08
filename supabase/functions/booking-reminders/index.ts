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

    // 1) Quick-booking timeout after 10 min: ask for resend to farther 3 stations.
    const tenMinAgo = new Date(now - 10 * 60 * 1000).toISOString();
    const { data: timedOutBookings } = await supabase
      .from("quick_booking_requests")
      .select("id, customer_phone, service_kind, booking_date, booking_time, language, quick_booking_targets(station_id, bookings(booking_number, stations(name)))")
      .eq("status", "pending")
      .eq("timeout_notified", false)
      .lt("created_at", tenMinAgo);

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
      const text =
        `⏰ لم يصل رد حتى الآن على طلب الحجز السريع${stationNames ? ` لدى ${stationNames}` : ""}.\n\n` +
        "هل توافق على إعادة إرسال الطلب إلى 3 محطات أبعد؟";

      const waId = await sendInteractive(
        request.customer_phone,
        text,
        [
          { id: "timeout_wait", title: "⏳ الانتظار" },
          { id: "timeout_resend_yes", title: "✅ نعم، أعد الإرسال" },
          { id: "timeout_search", title: "❌ لا، إلغاء الطلب" },
        ],
        settings,
      );

      if (waId) {
        await supabase.from("quick_booking_requests").update({ timeout_notified: true }).eq("id", request.id);
        await supabase.from("bot_sessions").upsert(
          {
            customer_phone: request.customer_phone,
            current_step: "timeout_alert",
            timeout_request_id: request.id,
            updated_at: new Date().toISOString(),
            expires_at: new Date(now + 30 * 60 * 1000).toISOString(),
          },
          { onConflict: "customer_phone" },
        );
        timeoutAlerts++;
      }
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
