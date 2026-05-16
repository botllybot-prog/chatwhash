import { createClient } from "npm:@supabase/supabase-js@2";

const headers = { "Content-Type": "application/json" };

function toTimestamp(date: string, time: string | null | undefined) {
  if (!date || !time) return Number.NaN;
  const normalizedTime = String(time).substring(0, 5);
  const value = Date.parse(`${date}T${normalizedTime}:00+03:00`);
  return Number.isFinite(value) ? value : Number.NaN;
}

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = Date.now();
    let quickTimeoutNotices = 0;
    let ratingNotices = 0;

    const { data: quickRequests } = await supabase
      .from("quick_booking_requests")
      .select("id, created_at, customer_phone, language, quick_booking_targets(booking_id, bookings(status, booking_number))")
      .eq("status", "pending")
      .eq("timeout_notified", false);

    for (const request of quickRequests || []) {
      const createdAt = new Date(String((request as any).created_at || 0)).getTime();
      if (!Number.isFinite(createdAt) || now - createdAt < 10 * 60 * 1000) continue;

      const targets = Array.isArray((request as any).quick_booking_targets)
        ? (request as any).quick_booking_targets
        : [];
      const targetBookings = targets.map((target: any) => target?.bookings).filter(Boolean);
      const hasAnsweredBooking = targetBookings.some((booking: any) =>
        booking?.status && booking.status !== "pending"
      );

      if (hasAnsweredBooking) {
        await supabase.from("quick_booking_requests").update({ status: "completed", timeout_notified: true }).eq("id", request.id);
        continue;
      }

      await supabase.from("quick_booking_requests").update({ timeout_notified: true }).eq("id", request.id);

      const firstBookingId = targets.find((target: any) => target?.booking_id)?.booking_id || null;
      await supabase.from("customer_notifications").insert({
        customer_phone: request.customer_phone,
        title: "تأخر الرد على الحجز السريع",
        body: "لم يتم الرد خلال 10 دقائق. يمكنك إرسال طلب سريع جديد لمحطات أخرى ضمن النطاق أو إلغاء الحجوزات من صندوق البريد.",
        reference_booking_id: firstBookingId,
      });
      quickTimeoutNotices++;
    }

    const { data: ratingCandidates } = await supabase
      .from("bookings")
      .select("id, booking_number, customer_phone, booking_date, booking_time, stations(name)")
      .eq("status", "confirmed")
      .eq("rating_requested", false)
      .not("booking_date", "is", null)
      .not("booking_time", "is", null);

    for (const booking of ratingCandidates || []) {
      const bookingAt = toTimestamp(String(booking.booking_date), String(booking.booking_time));
      if (!Number.isFinite(bookingAt) || now < bookingAt + 60 * 60 * 1000) continue;

      await supabase
        .from("bookings")
        .update({ rating_requested: true, rating_requested_at: new Date().toISOString() })
        .eq("id", booking.id);

      const stationName = (booking.stations as any)?.name || "المحطة";
      await supabase.from("customer_notifications").insert({
        customer_phone: booking.customer_phone,
        title: "قيّم تجربة الغسل",
        body: `حجز #${booking.booking_number} لدى ${stationName}. اضغط تأكيد إتمام المهمة من صندوق البريد ثم اختر التقييم.`,
        reference_booking_id: booking.id,
      });
      ratingNotices++;
    }

    return new Response(JSON.stringify({ success: true, quickTimeoutNotices, ratingNotices }), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers,
    });
  }
});
