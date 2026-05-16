import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string) {
  const western = phone
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
  const cleaned = western.replace(/[^\d+]/g, "").replace(/^\+/, "");
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
    const rating = Number(body.rating);
    const customerPhone = normalizePhone(String(body.customer_phone || "").trim());
    const sessionToken = String(body.session_token || "").trim();

    if (!bookingId || !customerPhone || !sessionToken || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return new Response(JSON.stringify({ error: "البيانات المطلوبة غير صحيحة." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: session } = await supabase
      .from("customer_web_sessions")
      .select("customer_phone, expires_at")
      .eq("session_token", sessionToken)
      .maybeSingle();

    if (!session || normalizePhone(String(session.customer_phone || "")) !== customerPhone || new Date(session.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "جلسة الزبون غير صالحة. سجل الدخول مرة أخرى." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, booking_number, customer_name, customer_phone, station_id, status, customer_rating, stations(name), services(name)")
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError || !booking || normalizePhone(String((booking as any).customer_phone || "")) !== customerPhone) {
      return new Response(JSON.stringify({ error: "تعذر العثور على هذا الحجز." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = String((booking as any).status || "");
    if (!["confirmed", "completed"].includes(status)) {
      return new Response(JSON.stringify({ error: "يمكن تقييم الحجز بعد تأكيده فقط." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((booking as any).customer_rating) {
      return new Response(JSON.stringify({ error: "تم تقييم هذا الحجز مسبقاً." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from("bookings")
      .update({
        status: "completed",
        customer_rating: rating,
        rated_at: now,
        rating_requested: true,
        rating_requested_at: now,
      })
      .eq("id", bookingId)
      .select("id, booking_number, status, customer_rating, rated_at, station_id")
      .single();

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("customer_notifications").insert({
      customer_phone: customerPhone,
      title: "شكراً لتقييمك",
      body: `تم تسجيل تقييمك (${rating}/5) للحجز #${(booking as any).booking_number || updated.booking_number}.`,
      reference_booking_id: bookingId,
    });

    const stationName = (booking as any)?.stations?.name || "محطة";
    const serviceName = (booking as any)?.services?.name || "خدمة";
    const customerName = (booking as any)?.customer_name || customerPhone;
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (admins?.length) {
      await supabase.from("notifications").insert(
        admins.map((admin: any) => ({
          user_id: admin.user_id,
          title: "تقييم جديد لمحطة غسل",
          body: `${stationName} - ${rating}/5 - ${serviceName} - الزبون ${customerName} - الحجز #${(booking as any).booking_number || updated.booking_number}`,
          type: "rating",
          reference_id: bookingId,
        })),
      );
    }

    return new Response(JSON.stringify({ success: true, booking: updated }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
