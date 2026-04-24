import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned;
}

function formatTime(time: string | null) {
  return time ? time.substring(0, 5) : "بدون وقت محدد";
}

async function getSettings(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase.from("app_settings").select("key, value");
  const settings: Record<string, string> = {};
  for (const row of data || []) settings[row.key] = row.value;
  return settings;
}

async function sendWhatsAppMessage(
  phone: string,
  message: string,
  settings: Record<string, string>
) {
  const token = settings.WHATSAPP_ACCESS_TOKEN;
  const phoneId = settings.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId || !phone) return;

  await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: message },
    }),
  });
}

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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const stationId = body.station_id as string | undefined;
    const serviceId = body.service_id as string | undefined;
    const customerName = (body.customer_name as string | undefined)?.trim() || null;
    const rawPhone = (body.customer_phone as string | undefined)?.trim() || "";
    const bookingDate = body.booking_date as string | undefined;
    const bookingTime = (body.booking_time as string | null | undefined) || null;
    const customerPhone = normalizePhone(rawPhone);

    if (!stationId || !serviceId || !customerName || !customerPhone || !bookingDate) {
      return new Response(JSON.stringify({ error: "البيانات المطلوبة غير مكتملة." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];
    if (bookingDate < today) {
      return new Response(JSON.stringify({ error: "لا يمكن إنشاء حجز بتاريخ سابق." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: station }, { data: service }] = await Promise.all([
      supabase
        .from("stations")
        .select("id, name, scheduling_type, slot_duration_minutes, working_hours_start, working_hours_end, is_active")
        .eq("id", stationId)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("services")
        .select("id, name, price, station_id, is_active")
        .eq("id", serviceId)
        .eq("is_active", true)
        .maybeSingle(),
    ]);

    if (!station) {
      return new Response(JSON.stringify({ error: "المحطة غير متاحة حالياً." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!service || (service.station_id && service.station_id !== stationId)) {
      return new Response(JSON.stringify({ error: "الخدمة المحددة لا تنتمي إلى هذه المحطة." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (station.scheduling_type === "slots" && !bookingTime) {
      return new Response(JSON.stringify({ error: "يرجى اختيار وقت للحجز." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (station.scheduling_type === "slots" && bookingTime) {
      const { data: existingSlot } = await supabase
        .from("bookings")
        .select("id")
        .eq("station_id", stationId)
        .eq("booking_date", bookingDate)
        .eq("booking_time", bookingTime)
        .in("status", ["pending", "confirmed"])
        .maybeSingle();

      if (existingSlot) {
        return new Response(JSON.stringify({ error: "هذا الموعد محجوز بالفعل. اختر وقتاً آخر." }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: existingCustomerBooking } = await supabase
      .from("bookings")
      .select("id, booking_number")
      .eq("customer_phone", customerPhone)
      .eq("station_id", stationId)
      .eq("booking_date", bookingDate)
      .eq("service_id", serviceId)
      .in("status", ["pending", "confirmed"])
      .maybeSingle();

    if (existingCustomerBooking) {
      return new Response(
        JSON.stringify({
          error: `لديك حجز نشط بالفعل برقم #${existingCustomerBooking.booking_number} في هذه المحطة.`,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        customer_name: customerName,
        customer_phone: customerPhone,
        station_id: stationId,
        service_id: serviceId,
        booking_date: bookingDate,
        booking_time: bookingTime,
        status: "pending",
      })
      .select("id, booking_number")
      .single();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: bookingError?.message || "تعذر حفظ الحجز." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [ownerResult, adminResult, settings] = await Promise.all([
      supabase
        .from("station_owners")
        .select("user_id, owner_phone, stations(name)")
        .eq("station_id", stationId)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1)
        .maybeSingle(),
      getSettings(supabase),
    ]);

    const owner = ownerResult.data;
    const adminUser = adminResult.data;
    const stationName = owner?.stations?.name || station.name;
    const summary = `حجز جديد #${booking.booking_number} - ${service.name} - ${bookingDate} ${formatTime(bookingTime)}`;

    if (owner?.user_id) {
      await supabase.from("notifications").insert({
        user_id: owner.user_id,
        title: "حجز جديد من الخريطة",
        body: summary,
        type: "booking",
        reference_id: booking.id,
      });
    }

    if (adminUser?.user_id) {
      await supabase.from("notifications").insert({
        user_id: adminUser.user_id,
        title: "حجز جديد من الخريطة",
        body: `${customerName} - ${stationName} - ${summary}`,
        type: "booking",
        reference_id: booking.id,
      });
    }

    if (owner?.owner_phone) {
      await sendWhatsAppMessage(
        normalizePhone(owner.owner_phone),
        `📢 حجز جديد من الخريطة\n\n🏪 المحطة: ${stationName}\n🔢 رقم الحجز: #${booking.booking_number}\n👤 العميل: ${customerName}\n📱 الهاتف: ${customerPhone}\n🧽 الخدمة: ${service.name}\n📅 التاريخ: ${bookingDate}\n⏰ الوقت: ${formatTime(bookingTime)}`,
        settings
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        bookingId: booking.id,
        bookingNumber: booking.booking_number,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع.";

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
