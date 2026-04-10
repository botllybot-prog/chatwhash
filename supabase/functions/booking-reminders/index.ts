import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Check if reminders are enabled
    const { data: settingsData } = await supabase
      .from("app_settings")
      .select("key, value");

    const settings: Record<string, string> = {};
    if (settingsData) {
      for (const row of settingsData) {
        settings[row.key] = row.value;
      }
    }

    if (settings.REMINDERS_ENABLED !== "true") {
      return new Response(
        JSON.stringify({ message: "Reminders disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = settings.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = settings.WHATSAPP_PHONE_NUMBER_ID;
    const telegramToken = settings.TELEGRAM_BOT_TOKEN;
    const hasWhatsApp = !!(accessToken && phoneNumberId);
    const hasTelegram = !!telegramToken;

    if (!hasWhatsApp && !hasTelegram) {
      console.error("No messaging platform configured");
      return new Response(
        JSON.stringify({ error: "No messaging platform configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const reminderMessage = settings.REMINDER_MESSAGE || "تذكير: لديك حجز غسيل سيارة خلال ساعة. نتطلع لخدمتك! 🚗✨";
    const reminderHours = parseInt(settings.REMINDER_HOURS_BEFORE || "1") || 1;

    // Find bookings within the reminder window that haven't been reminded
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + reminderHours * 60 * 60 * 1000);
    const today = now.toISOString().split("T")[0];
    const todayPlus1 = oneHourLater.toISOString().split("T")[0];

    // Get current time and one-hour-later time as HH:MM:SS
    const nowTime = now.toTimeString().substring(0, 8);
    const laterTime = oneHourLater.toTimeString().substring(0, 8);

    // Query bookings for today (or tomorrow if near midnight) that are within the next hour
    let query = supabase
      .from("bookings")
      .select("*, stations(name), services(name)")
      .eq("reminder_sent", false)
      .in("status", ["pending", "confirmed"]);

    // Handle same-day case
    if (today === todayPlus1) {
      query = query
        .eq("booking_date", today)
        .gte("booking_time", nowTime)
        .lte("booking_time", laterTime);
    } else {
      // Near midnight - check today's remaining + tomorrow's early
      query = query
        .or(
          `and(booking_date.eq.${today},booking_time.gte.${nowTime}),and(booking_date.eq.${todayPlus1},booking_time.lte.${laterTime})`
        );
    }

    const { data: bookings, error: bookingsErr } = await query;

    if (bookingsErr) {
      console.error("Error querying bookings:", bookingsErr);
      return new Response(
        JSON.stringify({ error: "Failed to query bookings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${bookings?.length || 0} bookings to remind`);

    let sent = 0;
    for (const booking of bookings || []) {
      const stationName = (booking as any).stations?.name || "";
      const serviceName = (booking as any).services?.name || "";
      const time = booking.booking_time?.substring(0, 5) || "";

      const personalizedMsg = reminderMessage
        .replace("{station}", stationName)
        .replace("{service}", serviceName)
        .replace("{time}", time)
        .replace("{date}", booking.booking_date)
        .replace("{booking_number}", String(booking.booking_number));

      // Detect platform from conversation
      const { data: conv } = await supabase
        .from("conversations")
        .select("id, platform")
        .eq("customer_phone", booking.customer_phone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const platform = conv?.platform || "whatsapp";
      let sendOk = false;

      try {
        if (platform === "telegram" && hasTelegram) {
          // Send via Telegram
          const tgRes = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: booking.customer_phone, text: personalizedMsg, parse_mode: "HTML" }),
          });
          const tgData = await tgRes.json();
          sendOk = tgData.ok === true;

          if (sendOk && conv) {
            await supabase.from("messages").insert({
              conversation_id: conv.id, direction: "outbound", content: personalizedMsg,
              message_type: "text", whatsapp_message_id: String(tgData.result?.message_id || ""),
              status: "sent", platform: "telegram",
            });
          }
        } else if (hasWhatsApp) {
          // Send via WhatsApp
          const waResponse = await fetch(
            `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ messaging_product: "whatsapp", to: booking.customer_phone, type: "text", text: { body: personalizedMsg } }),
            }
          );
          sendOk = waResponse.ok;

          if (!sendOk) {
            const errData = await waResponse.json();
            console.error(`Failed to send WhatsApp reminder to ${booking.customer_phone}:`, errData);
          }

          if (sendOk && conv) {
            await supabase.from("messages").insert({
              conversation_id: conv.id, direction: "outbound", content: personalizedMsg,
              message_type: "text", status: "sent", platform: "whatsapp",
            });
          }
        }

        if (sendOk) {
          await supabase.from("bookings").update({ reminder_sent: true }).eq("id", booking.id);

          if (conv) {
            await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conv.id);
          }

          sent++;
          console.log(`Reminder sent via ${platform} to ${booking.customer_phone} for booking #${booking.booking_number}`);
        }
      } catch (e) {
        console.error(`Error sending reminder to ${booking.customer_phone}:`, e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, reminders_sent: sent, total_found: bookings?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Reminder error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
