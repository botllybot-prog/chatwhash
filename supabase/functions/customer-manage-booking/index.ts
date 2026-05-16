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
    const action = String(body.action || "").trim(); // cancel | postpone
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
      const { data: owner } = await supabase
        .from("station_owners")
        .select("user_id")
        .eq("station_id", (booking as any).station_id)
        .maybeSingle();

      if (owner?.user_id) {
        const title = action === "cancel" ? "إلغاء من الزبون" : "طلب تأجيل من الزبون";
        const body =
          action === "cancel"
            ? `الزبون ${(booking as any)?.customer_name || customerPhone} ألغى الحجز #${(booking as any)?.booking_number || ""}.`
            : `الزبون ${(booking as any)?.customer_name || customerPhone} طلب تأجيل الحجز #${(booking as any)?.booking_number || ""} إلى ${updated.booking_date} ${String(updated.booking_time || "").slice(0, 5)}.`;
        await supabase.from("notifications").insert({
          user_id: owner.user_id,
          title,
          body,
          type: "booking",
          reference_id: bookingId,
        });
      }
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
