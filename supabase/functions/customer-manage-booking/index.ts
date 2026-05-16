import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned;
}

type Action = "cancel" | "postpone" | "accept_postpone";
const ACTIVE_BOOKING_STATUSES = ["pending", "pending_owner_approval", "pending_customer_approval", "confirmed"];
const PENDING_ALTERNATIVE_STATUSES = ["pending", "pending_owner_approval", "pending_customer_approval"];

async function notifyStationOwner(
  supabase: ReturnType<typeof createClient>,
  stationId: string,
  title: string,
  body: string,
  referenceId: string,
) {
  const { data: owner } = await supabase
    .from("station_owners")
    .select("user_id")
    .eq("station_id", stationId)
    .maybeSingle();

  if (!owner?.user_id) return;

  await supabase.from("notifications").insert({
    user_id: owner.user_id,
    title,
    body,
    type: "booking",
    reference_id: referenceId,
  });
}

async function cancelOtherPendingBookings(
  supabase: ReturnType<typeof createClient>,
  confirmedBooking: {
    id: string;
    customer_phone?: string | null;
    booking_number?: number | null;
    booking_date?: string | null;
    booking_time?: string | null;
  },
) {
  const customerPhone = String(confirmedBooking.customer_phone || "").trim();
  if (!customerPhone) return 0;

  let otherBookingsQuery = supabase
    .from("bookings")
    .select("id, station_id, booking_number")
    .eq("customer_phone", customerPhone)
    .neq("id", confirmedBooking.id)
    .in("status", PENDING_ALTERNATIVE_STATUSES);

  if (confirmedBooking.booking_date) {
    otherBookingsQuery = otherBookingsQuery.eq("booking_date", confirmedBooking.booking_date);
  }
  if (confirmedBooking.booking_time) {
    otherBookingsQuery = otherBookingsQuery.eq("booking_time", confirmedBooking.booking_time);
  }

  const { data: otherBookings, error: lookupError } = await otherBookingsQuery;

  if (lookupError || !otherBookings?.length) return 0;

  const otherIds = otherBookings.map((booking: any) => booking.id).filter(Boolean);
  if (otherIds.length === 0) return 0;

  const { error: cancelError } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .in("id", otherIds);

  if (cancelError) throw cancelError;

  await supabase
    .from("quick_booking_targets")
    .update({ state: "cancelled" })
    .in("booking_id", otherIds);

  await Promise.allSettled(
    otherBookings.map((booking: any) =>
      notifyStationOwner(
        supabase,
        String(booking.station_id || ""),
        "تم إلغاء الحجز تلقائياً",
        `تم إلغاء الحجز #${booking.booking_number || ""} لأن الزبون وافق على حجز آخر.`,
        String(booking.id || ""),
      ),
    ),
  );

  return otherIds.length;
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
    const action = String(body.action || "").trim() as Action; // cancel | postpone | accept_postpone
    const bookingDate = String(body.booking_date || "").trim();
    const bookingTime = String(body.booking_time || "").trim();
    const customerPhone = normalizePhone(String(body.customer_phone || "").trim());
    const sessionToken = String(body.session_token || "").trim();

    if (!bookingId || !action || !customerPhone || !sessionToken) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: session } = await supabase
      .from("customer_web_sessions")
      .select("id, expires_at, customer_phone")
      .eq("session_token", sessionToken)
      .maybeSingle();

    if (!session || String(session.customer_phone) !== customerPhone || new Date(session.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, customer_phone, status, booking_number, booking_date, booking_time, customer_name, station_id, stations(name)")
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking || normalizePhone(String(booking.customer_phone || "")) !== customerPhone) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentStatus = String((booking as any).status || "");
    if (!ACTIVE_BOOKING_STATUSES.includes(currentStatus)) {
      return new Response(JSON.stringify({ error: "هذا الحجز لم يعد قابلاً للتعديل أو الإلغاء.", current_status: currentStatus }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: Record<string, unknown> = {};
    if (action === "cancel") {
      payload.status = "cancelled";
    } else if (action === "postpone") {
      if (!bookingDate || !bookingTime) {
        return new Response(JSON.stringify({ error: "booking_date and booking_time required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      payload.booking_date = bookingDate;
      payload.booking_time = bookingTime;
      payload.status = "pending_owner_approval";
    } else if (action === "accept_postpone") {
      if (currentStatus !== "pending_customer_approval") {
        return new Response(JSON.stringify({ error: "لا يوجد موعد جديد بانتظار موافقتك لهذا الحجز." }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      payload.status = "confirmed";
    } else {
      return new Response(JSON.stringify({ error: "Unsupported action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: updated, error: updateError } = await supabase
      .from("bookings")
      .update(payload)
      .eq("id", bookingId)
      .select("id, booking_number, status, booking_date, booking_time")
      .single();
    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((booking as any)?.station_id) {
      const title =
        action === "cancel"
          ? "إلغاء من الزبون"
          : action === "accept_postpone"
            ? "موافقة الزبون على الموعد"
            : "طلب تأجيل من الزبون";
      const body =
        action === "cancel"
          ? `الزبون ${(booking as any)?.customer_name || customerPhone} ألغى الحجز #${(booking as any)?.booking_number || ""}.`
          : action === "accept_postpone"
            ? `الزبون ${(booking as any)?.customer_name || customerPhone} وافق على الموعد الجديد للحجز #${(booking as any)?.booking_number || ""}.`
            : `الزبون ${(booking as any)?.customer_name || customerPhone} طلب تأجيل الحجز #${(booking as any)?.booking_number || ""} إلى ${updated.booking_date} ${String(updated.booking_time || "").slice(0, 5)}.`;
      await notifyStationOwner(supabase, String((booking as any).station_id), title, body, bookingId);
    }

    await supabase
      .from("quick_booking_targets")
      .update({ state: action === "cancel" ? "cancelled" : action === "accept_postpone" ? "confirmed" : "pending" })
      .eq("booking_id", bookingId);

    let cancelledAlternatives = 0;
    if (action === "accept_postpone") {
      cancelledAlternatives = await cancelOtherPendingBookings(supabase, {
        id: bookingId,
        customer_phone: (booking as any).customer_phone,
        booking_number: updated.booking_number,
        booking_date: updated.booking_date,
        booking_time: updated.booking_time,
      });
    }

    return new Response(JSON.stringify({ success: true, booking: updated, cancelledAlternatives }), {
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
