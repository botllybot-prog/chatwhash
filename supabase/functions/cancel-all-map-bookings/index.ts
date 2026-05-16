import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  const cleaned = String(phone || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned;
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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const customerPhone = normalizePhone(String(body.customer_phone || "").trim());

    if (!customerPhone) {
      return new Response(JSON.stringify({ error: "customer_phone is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("id, booking_number, customer_name, customer_phone, station_id, status, stations(name), services(name)")
      .eq("customer_phone", customerPhone)
      .in("status", ["pending", "confirmed", "pending_customer_approval"]);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!bookings?.length) {
      return new Response(JSON.stringify({ success: true, cancelledCount: 0, alreadyEmpty: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bookingIds = bookings.map((booking) => booking.id);

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

    await supabase
      .from("quick_booking_targets")
      .update({ state: "cancelled" })
      .in("booking_id", bookingIds)
      .eq("state", "pending");

    const { data: owners } = await supabase
      .from("station_owners")
      .select("station_id, user_id")
      .in("station_id", bookings.map((booking) => booking.station_id).filter(Boolean));
    const ownerByStation = new Map<string, string>();
    for (const owner of owners || []) {
      if (owner.station_id && owner.user_id && !ownerByStation.has(owner.station_id)) {
        ownerByStation.set(owner.station_id, owner.user_id);
      }
    }

    const customerName = bookings[0]?.customer_name || customerPhone;
    const ownerNotifications = [];
    const customerNotifications = [];

    for (const booking of bookings) {
      const stationName = (booking.stations as { name?: string } | null)?.name || "المحطة";
      const serviceName = (booking.services as { name?: string } | null)?.name || "الخدمة";
      const summary = `الحجز #${booking.booking_number} - ${stationName} - ${serviceName}`;

      customerNotifications.push({
        customer_phone: customerPhone,
        title: "تم إلغاء الحجز",
        body: `${summary} تم إلغاؤه بناءً على طلبك.`,
        reference_booking_id: booking.id,
      });

      const ownerUserId = ownerByStation.get(booking.station_id);
      if (ownerUserId) {
        ownerNotifications.push({
          user_id: ownerUserId,
          title: "تم إلغاء حجز",
          body: `${summary} أُلغي من قبل العميل ${customerName}.`,
          type: "booking",
          reference_id: booking.id,
        });
      }
    }

    if (customerNotifications.length) {
      await supabase.from("customer_notifications").insert(customerNotifications);
    }
    if (ownerNotifications.length) {
      await supabase.from("notifications").insert(ownerNotifications);
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
