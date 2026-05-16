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
    const bookingId = String(body.booking_id || "").trim();
    const customerPhone = normalizePhone(String(body.customer_phone || "").trim());

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
        status,
        station_id,
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

    await supabase
      .from("quick_booking_targets")
      .update({ state: "cancelled" })
      .eq("booking_id", booking.id)
      .eq("state", "pending");

    const [ownerResult, adminResult] = await Promise.all([
      supabase
        .from("station_owners")
        .select("user_id")
        .eq("station_id", booking.station_id)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1)
        .maybeSingle(),
    ]);

    const stationName = (booking.stations as { name?: string } | null)?.name || "المحطة";
    const serviceName = (booking.services as { name?: string } | null)?.name || "الخدمة";
    const customerName = booking.customer_name || customerPhone;
    const bodyText = `الحجز #${booking.booking_number} - ${stationName} - ${serviceName}`;

    await supabase.from("customer_notifications").insert({
      customer_phone: customerPhone,
      title: "تم إلغاء الحجز",
      body: `${bodyText} تم إلغاؤه بناءً على طلبك.`,
      reference_booking_id: booking.id,
    });

    if (ownerResult.data?.user_id) {
      await supabase.from("notifications").insert({
        user_id: ownerResult.data.user_id,
        title: "تم إلغاء حجز",
        body: `${bodyText} أُلغي من قبل العميل ${customerName}.`,
        type: "booking",
        reference_id: booking.id,
      });
    }

    if (adminResult.data?.user_id) {
      await supabase.from("notifications").insert({
        user_id: adminResult.data.user_id,
        title: "تم إلغاء حجز",
        body: `${bodyText} أُلغي من قبل العميل ${customerName}.`,
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
