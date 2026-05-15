import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "confirm" | "reject" | "postpone";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const bookingId = String(body.booking_id || "").trim();
    const action = String(body.action || "").trim() as Action;
    const bookingDate = String(body.booking_date || "").trim();
    const bookingTime = String(body.booking_time || "").trim();

    if (!bookingId || !action) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ownerRow, error: ownerError } = await supabaseAdmin
      .from("station_owners")
      .select("station_id, is_active")
      .eq("user_id", user.id)
      .maybeSingle();

    if (ownerError || !ownerRow?.station_id || ownerRow?.is_active === false) {
      return new Response(JSON.stringify({ error: "Owner profile not active" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: bookingRow, error: bookingLookupError } = await supabaseAdmin
      .from("bookings")
      .select("id, station_id, status, booking_number, booking_date, booking_time, customer_name, customer_phone, stations(name)")
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingLookupError || !bookingRow) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (String(bookingRow.station_id) !== String(ownerRow.station_id)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actionableStatuses = new Set(["pending", "pending_owner_approval"]);
    if (!actionableStatuses.has(String(bookingRow.status || ""))) {
      const message =
        bookingRow.status === "cancelled"
          ? "تم إلغاء هذا الحجز من الزبون أو الإدارة، ولا يمكن تأكيده مرة أخرى."
          : "هذا الحجز لم يعد قابلًا لإجراء جديد من المحطة.";
      return new Response(JSON.stringify({ error: message, current_status: bookingRow.status }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: Record<string, unknown> = {};
    if (action === "confirm") {
      payload.status = "confirmed";
    } else if (action === "reject") {
      payload.status = "cancelled";
    } else if (action === "postpone") {
      if (!bookingDate || !bookingTime) {
        return new Response(JSON.stringify({ error: "booking_date and booking_time are required for postpone" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      payload.booking_date = bookingDate;
      payload.booking_time = bookingTime;
      payload.status = "pending_customer_approval";
    } else {
      return new Response(JSON.stringify({ error: "Unsupported action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
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

    const stationName = (bookingRow as any)?.stations?.name || "Washlly";
    const actionLabel =
      action === "confirm"
        ? "تم تأكيد الحجز"
        : action === "reject"
          ? "تم رفض الحجز"
          : "تم تعديل موعد الحجز";
    const customerBody =
      action === "postpone"
        ? `${stationName} - ${actionLabel} #${updated.booking_number} إلى ${updated.booking_date} ${String(updated.booking_time || "").slice(0, 5)}`
        : `${stationName} - ${actionLabel} #${updated.booking_number}`;

    if ((bookingRow as any)?.customer_phone) {
      await supabaseAdmin.from("customer_notifications").insert({
        customer_phone: String((bookingRow as any).customer_phone),
        title: actionLabel,
        body: customerBody,
        reference_booking_id: bookingId,
      });
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
