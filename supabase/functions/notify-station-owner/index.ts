import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow service_role or internal calls
    const authHeader = req.headers.get("authorization") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!authHeader.includes(serviceRoleKey)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { booking_id, station_id } = await req.json();

    if (!booking_id || !station_id) {
      return new Response(JSON.stringify({ error: "Missing booking_id or station_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get station owner
    const { data: owner } = await supabase
      .from("station_owners")
      .select("user_id, owner_phone, owner_name, stations(name)")
      .eq("station_id", station_id)
      .maybeSingle();

    if (!owner) {
      return new Response(JSON.stringify({ message: "No owner for this station" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get booking details
    const { data: booking } = await supabase
      .from("bookings")
      .select("booking_number, customer_phone, booking_date, booking_time, services(name, price)")
      .eq("id", booking_id)
      .single();

    if (!booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create in-app notification
    await supabase.from("notifications").insert({
      user_id: owner.user_id,
      title: "حجز جديد",
      body: `حجز جديد #${booking.booking_number} - ${(booking as any).services?.name} - ${booking.booking_date}${booking.booking_time ? " " + booking.booking_time.substring(0, 5) : ""}`,
      type: "booking",
      reference_id: booking_id,
    });

    // Send WhatsApp notification if owner has phone
    if (owner.owner_phone) {
      const { data: settings } = await supabase.from("app_settings").select("key, value");
      const settingsMap: Record<string, string> = {};
      if (settings) settings.forEach((s: any) => { settingsMap[s.key] = s.value; });

      const accessToken = settingsMap.WHATSAPP_ACCESS_TOKEN;
      const phoneNumberId = settingsMap.WHATSAPP_PHONE_NUMBER_ID;

      if (accessToken && phoneNumberId) {
        const stationName = (owner as any).stations?.name || "";
        const msg = `📢 حجز جديد في ${stationName}\n\n🔢 رقم الحجز: #${booking.booking_number}\n📱 العميل: ${booking.customer_phone}\n🧽 الخدمة: ${(booking as any).services?.name} - ${(booking as any).services?.price} د.ع\n📅 التاريخ: ${booking.booking_date}${booking.booking_time ? "\n⏰ الوقت: " + booking.booking_time.substring(0, 5) : ""}`;

        await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: owner.owner_phone,
            type: "text",
            text: { body: msg },
          }),
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
