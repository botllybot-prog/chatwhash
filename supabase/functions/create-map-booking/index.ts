import { createClient } from "npm:@supabase/supabase-js@2";
import { consumeStationRequestQuota, loadAppSettings } from "../_shared/request-packages.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Language = "ar" | "en" | "ku" | "tr";

const i18n: Record<
  Language,
  {
    dateLocale: string;
    errors: {
      missing: string;
      spinRequired: string;
      pastDate: string;
      stationUnavailable: string;
      serviceMismatch: string;
      chooseTime: string;
      slotTaken: string;
      verifyActiveBookings: string;
      activeLimit: string;
      verifySpin: string;
      spinInvalid: string;
      saveFailed: string;
      duplicateAtStation: (bookingNo: string | number) => string;
      unexpected: string;
    };
    ownerButtons: { approve: string; reject: string };
    labels: {
      newMapBooking: string;
      station: string;
      service: string;
      discount: string;
      date: string;
      time: string;
      bookingNo: string;
      customer: string;
      phone: string;
      ownerChoose: string;
      customerPending: string;
    };
  }
> = {
  ar: {
    dateLocale: "ar-IQ",
    errors: {
      missing: "البيانات المطلوبة غير مكتملة.",
      spinRequired: "يرجى تدوير عجلة الخصم قبل تأكيد الحجز.",
      pastDate: "لا يمكن إنشاء حجز بتاريخ سابق.",
      stationUnavailable: "المحطة غير متاحة حالياً.",
      serviceMismatch: "الخدمة المحددة لا تنتمي إلى هذه المحطة.",
      chooseTime: "يرجى اختيار وقت للحجز.",
      slotTaken: "هذا الموعد محجوز بالفعل. اختر وقتاً آخر.",
      verifyActiveBookings: "تعذر التحقق من عدد الحجوزات الحالية.",
      activeLimit: "لا يمكن إنشاء أكثر من حجزين نشطين لنفس الرقم. ألغِ أحد الحجوزات الحالية أولاً.",
      verifySpin: "تعذر التحقق من خصم عجلة الحظ.",
      spinInvalid: "تعذر اعتماد نتيجة عجلة الخصم. أعد المحاولة مرة أخرى.",
      saveFailed: "تعذر حفظ الحجز.",
      duplicateAtStation: (bookingNo) => `لديك حجز سابق بالفعل برقم #${bookingNo} في هذه المحطة. يجب عليك إلغاء الحجز الحالي ثم الحجز من جديد.`,
      unexpected: "حدث خطأ غير متوقع.",
    },
    ownerButtons: { approve: "✅ تأكيد", reject: "❌ رفض" },
    labels: {
      newMapBooking: "طلب حجز جديد من الخريطة",
      station: "المحطة",
      service: "الخدمة",
      discount: "الخصم",
      date: "التاريخ",
      time: "الوقت",
      bookingNo: "رقم الحجز",
      customer: "العميل",
      phone: "الهاتف",
      ownerChoose: "اختر أحد الخيارات:",
      customerPending: "الطلب الآن بانتظار موافقة صاحب المحطة، وسيصلك إشعار القبول أو الرفض على هذا الرقم.",
    },
  },
  en: {
    dateLocale: "en-US",
    errors: {
      missing: "Required booking data is incomplete.",
      spinRequired: "Please spin the discount wheel before confirming.",
      pastDate: "Cannot create a booking in the past.",
      stationUnavailable: "Station is currently unavailable.",
      serviceMismatch: "Selected service does not belong to this station.",
      chooseTime: "Please choose a booking time.",
      slotTaken: "This time slot is already booked. Choose another time.",
      verifyActiveBookings: "Could not verify active bookings count.",
      activeLimit: "You cannot have more than 2 active bookings for the same phone number.",
      verifySpin: "Could not verify spin discount.",
      spinInvalid: "Spin result is no longer valid. Please spin again.",
      saveFailed: "Could not save booking.",
      duplicateAtStation: (bookingNo) => `You already have an active booking #${bookingNo} at this station. Cancel it first to book again.`,
      unexpected: "Unexpected error occurred.",
    },
    ownerButtons: { approve: "✅ Approve", reject: "❌ Reject" },
    labels: {
      newMapBooking: "New booking request from map",
      station: "Station",
      service: "Service",
      discount: "Discount",
      date: "Date",
      time: "Time",
      bookingNo: "Booking number",
      customer: "Customer",
      phone: "Phone",
      ownerChoose: "Choose an action:",
      customerPending: "Your request is pending station approval. You will receive an approve/reject update on this number.",
    },
  },
  ku: {
    dateLocale: "ckb-IQ",
    errors: {
      missing: "زانیاری پێویست تەواو نییە.",
      spinRequired: "تکایە پێش پشتڕاستکردنەوە گەردی داشکاندن بگێڕە.",
      pastDate: "ناتوانرێت بۆ ڕۆژی ڕابردوو حجز دروست بکرێت.",
      stationUnavailable: "وێستگەکە ئێستا بەردەست نییە.",
      serviceMismatch: "خزمەتگوزاری هەڵبژێردراو بۆ ئەم وێستگەیە نییە.",
      chooseTime: "تکایە کاتی حجز هەڵبژێرە.",
      slotTaken: "ئەم کاتە پڕکراوە. کاتێکی تر هەڵبژێرە.",
      verifyActiveBookings: "ناتوانرێت ژمارەی حجزە چالاکەکان بپشکنرێت.",
      activeLimit: "بۆ هەمان ژمارە زیاتر لە 2 حجزی چالاک ناتوانرێت دروست بکرێت.",
      verifySpin: "ناتوانرێت داشکاندنی گەردەکە بپشکنرێت.",
      spinInvalid: "ئەنجامی گەردەکە ناگونجاوە. تکایە دووبارە بگێڕە.",
      saveFailed: "پاشەکەوتکردنی حجز سەرکەوتوو نەبوو.",
      duplicateAtStation: (bookingNo) => `لەو وێستگەیە حجزێکی چالاکت هەیە (#${bookingNo}). سەرەتا هەڵیبوەشێنەوە.`,
      unexpected: "هەڵەیەکی نەناسراو ڕوویدا.",
    },
    ownerButtons: { approve: "✅ پەسەندکردن", reject: "❌ ڕەتکردنەوە" },
    labels: {
      newMapBooking: "داواکاری حجزی نوێ لە نەخشە",
      station: "وێستگە",
      service: "خزمەتگوزاری",
      discount: "داشکاندن",
      date: "بەروار",
      time: "کات",
      bookingNo: "ژمارەی حجز",
      customer: "کڕیار",
      phone: "تەلەفۆن",
      ownerChoose: "یەکێک هەڵبژێرە:",
      customerPending: "داواکارییەکە چاوەڕێی پەسەندکردنی وێستگەیە. ئاگادارکردنەوە لەم ژمارەیە وەردەگریت.",
    },
  },
  tr: {
    dateLocale: "tr-TR",
    errors: {
      missing: "Gerekli rezervasyon bilgileri eksik.",
      spinRequired: "Onaydan önce indirim çarkını çevirin.",
      pastDate: "Geçmiş tarih için rezervasyon oluşturulamaz.",
      stationUnavailable: "İstasyon şu anda uygun değil.",
      serviceMismatch: "Seçilen hizmet bu istasyona ait değil.",
      chooseTime: "Lütfen rezervasyon saatini seçin.",
      slotTaken: "Bu saat dolu. Lütfen başka bir saat seçin.",
      verifyActiveBookings: "Aktif rezervasyon sayısı doğrulanamadı.",
      activeLimit: "Aynı numara için 2’den fazla aktif rezervasyon oluşturulamaz.",
      verifySpin: "Çark indirimi doğrulanamadı.",
      spinInvalid: "Çark sonucu geçersiz. Lütfen tekrar çevirin.",
      saveFailed: "Rezervasyon kaydedilemedi.",
      duplicateAtStation: (bookingNo) => `Bu istasyonda zaten aktif rezervasyonunuz var (#${bookingNo}). Yeniden rezervasyon için önce iptal edin.`,
      unexpected: "Beklenmeyen bir hata oluştu.",
    },
    ownerButtons: { approve: "✅ Onayla", reject: "❌ Reddet" },
    labels: {
      newMapBooking: "Haritadan yeni rezervasyon talebi",
      station: "İstasyon",
      service: "Hizmet",
      discount: "İndirim",
      date: "Tarih",
      time: "Saat",
      bookingNo: "Rezervasyon no",
      customer: "Müşteri",
      phone: "Telefon",
      ownerChoose: "Bir seçenek seçin:",
      customerPending: "Talebiniz istasyon onayı bekliyor. Onay/red sonucu bu numaraya gönderilecek.",
    },
  },
};

function normalizeLanguage(value: unknown): Language {
  if (value === "ar" || value === "en" || value === "ku" || value === "tr") return value;
  return "ar";
}

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned;
}

function formatTime(time: string | null) {
  return time ? time.substring(0, 5) : "بدون وقت محدد";
}

function fromBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return atob(padded);
}

async function signValue(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function verifySpinToken(
  token: string,
  expected: {
    station_id: string;
    service_id: string;
    booking_date: string;
    booking_time: string | null;
    customer_phone: string;
    discount_percent: number;
  },
  secret: string,
) {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return false;

  const expectedSignature = await signValue(encodedPayload, secret);
  if (expectedSignature !== signature) return false;

  const payload = JSON.parse(fromBase64Url(encodedPayload));

  if (payload.expires_at < Date.now()) return false;

  return (
    payload.station_id === expected.station_id &&
    payload.service_id === expected.service_id &&
    payload.booking_date === expected.booking_date &&
    (payload.booking_time || null) === expected.booking_time &&
    payload.customer_phone === expected.customer_phone &&
    payload.discount_percent === expected.discount_percent
  );
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
  settings: Record<string, string>,
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

async function sendWhatsAppInteractive(
  phone: string,
  body: string,
  buttons: { id: string; title: string }[],
  settings: Record<string, string>,
) {
  const token = settings.WHATSAPP_ACCESS_TOKEN;
  const phoneId = settings.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId || !phone) return null;

  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: body },
        action: {
          buttons: buttons.map((button) => ({
            type: "reply",
            reply: {
              id: button.id,
              title: button.title,
            },
          })),
        },
      },
    }),
  });

  const data = await response.json();
  return data?.messages?.[0]?.id || null;
}

async function getOrCreateSession(supabase: ReturnType<typeof createClient>, phone: string) {
  const { data: existing } = await supabase
    .from("bot_sessions")
    .select("*")
    .eq("customer_phone", phone)
    .maybeSingle();

  if (existing && new Date(existing.expires_at) > new Date()) return existing;

  const sessionData = {
    customer_phone: phone,
    current_step: "idle",
    selected_station_id: null,
    selected_service_id: null,
    selected_date: null,
    selected_time: null,
    vehicle_details: null,
    pending_booking_id: null,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase.from("bot_sessions").update(sessionData).eq("id", existing.id);
    return { ...existing, ...sessionData };
  }

  const { data: created } = await supabase.from("bot_sessions").insert(sessionData).select().single();
  return created;
}

async function updateSession(
  supabase: ReturnType<typeof createClient>,
  phone: string,
  updates: Record<string, unknown>,
) {
  await supabase
    .from("bot_sessions")
    .update({
      ...updates,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("customer_phone", phone);
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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const language = normalizeLanguage(body.language);
    const tt = i18n[language];
    const stationId = body.station_id as string | undefined;
    const serviceId = body.service_id as string | undefined;
    const customerName = (body.customer_name as string | undefined)?.trim() || null;
    const rawPhone = (body.customer_phone as string | undefined)?.trim() || "";
    const bookingDate = body.booking_date as string | undefined;
    const bookingTime = (body.booking_time as string | null | undefined) || null;
    const spinToken = (body.spin_token as string | undefined)?.trim() || "";
    const spinDiscountPercent = Number(body.spin_discount_percent ?? NaN);
    const customerPhone = normalizePhone(rawPhone);

    if (!stationId || !serviceId || !customerName || !customerPhone || !bookingDate) {
      return new Response(JSON.stringify({ error: tt.errors.missing }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!spinToken || ![0, 5, 10, 15].includes(spinDiscountPercent)) {
      return new Response(JSON.stringify({ error: tt.errors.spinRequired }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];
    if (bookingDate < today) {
      return new Response(JSON.stringify({ error: tt.errors.pastDate }), {
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
      return new Response(JSON.stringify({ error: tt.errors.stationUnavailable }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!service || (service.station_id && service.station_id !== stationId)) {
      return new Response(JSON.stringify({ error: tt.errors.serviceMismatch }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (station.scheduling_type === "slots" && !bookingTime) {
      return new Response(JSON.stringify({ error: tt.errors.chooseTime }), {
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
        return new Response(JSON.stringify({ error: tt.errors.slotTaken }), {
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
          error: tt.errors.duplicateAtStation(existingCustomerBooking.booking_number),
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { count: activeBookingsCount, error: activeBookingsError } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("customer_phone", customerPhone)
      .in("status", ["pending", "confirmed"]);

    if (activeBookingsError) {
      return new Response(JSON.stringify({ error: tt.errors.verifyActiveBookings }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((activeBookingsCount || 0) >= 2) {
      return new Response(
        JSON.stringify({
          error: tt.errors.activeLimit,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const spinSecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!spinSecret) {
      return new Response(JSON.stringify({ error: tt.errors.verifySpin }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSpinValid = await verifySpinToken(
      spinToken,
      {
        station_id: stationId,
        service_id: serviceId,
        booking_date: bookingDate,
        booking_time: bookingTime,
        customer_phone: customerPhone,
        discount_percent: spinDiscountPercent,
      },
      spinSecret,
    );

    if (!isSpinValid) {
      return new Response(JSON.stringify({ error: tt.errors.spinInvalid }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const settings = await loadAppSettings(supabase);

    const quotaResult = await consumeStationRequestQuota({
      supabase,
      settings,
      stationId,
    });

    if (!quotaResult.allowed) {
      return new Response(JSON.stringify({ error: quotaResult.message }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
        spin_discount_percent: spinDiscountPercent,
        status: "pending",
      })
      .select("id, booking_number")
      .single();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: bookingError?.message || tt.errors.saveFailed }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [ownerResult, adminResult] = await Promise.all([
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
    ]);

    const owner = ownerResult.data;
    const adminUser = adminResult.data;
    const stationName = owner?.stations?.name || station.name;
    const summary = `${tt.labels.newMapBooking} #${booking.booking_number} - ${service.name} - ${bookingDate} ${formatTime(bookingTime)} - ${tt.labels.discount} ${spinDiscountPercent}%`;

    if (owner?.user_id) {
      await supabase.from("notifications").insert({
        user_id: owner.user_id,
        title: tt.labels.newMapBooking,
        body: summary,
        type: "booking",
        reference_id: booking.id,
      });
    }

    if (adminUser?.user_id) {
      await supabase.from("notifications").insert({
        user_id: adminUser.user_id,
        title: tt.labels.newMapBooking,
        body: `${customerName} - ${stationName} - ${summary}`,
        type: "booking",
        reference_id: booking.id,
      });
    }

    const dateLabel = new Date(bookingDate).toLocaleDateString(tt.dateLocale, {
      calendar: "gregory",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const pendingMsg = `📩 ${tt.labels.newMapBooking}\n\n🏪 ${tt.labels.station}: ${stationName}\n🧽 ${tt.labels.service}: ${service.name}\n🎯 ${tt.labels.discount}: (${spinDiscountPercent})%\n📅 ${tt.labels.date}: ${dateLabel}\n⏰ ${tt.labels.time}: ${formatTime(bookingTime)}\n🔢 ${tt.labels.bookingNo}: #${booking.booking_number}\n\n⏳ ${tt.labels.customerPending}`;
    const notificationTasks: Promise<unknown>[] = [sendWhatsAppMessage(customerPhone, pendingMsg, settings)];

    if (owner?.owner_phone) {
      const ownerPhone = normalizePhone(owner.owner_phone);
      const ownerMsg = `📢 ${tt.labels.newMapBooking}!\n\n🏪 ${tt.labels.station}: ${stationName}\n🔢 ${tt.labels.bookingNo}: #${booking.booking_number}\n👤 ${tt.labels.customer}: ${customerName}\n📱 ${tt.labels.phone}: ${customerPhone}\n🧽 ${tt.labels.service}: ${service.name}\n🎯 ${tt.labels.discount}: (${spinDiscountPercent})%\n📅 ${tt.labels.date}: ${dateLabel}\n⏰ ${tt.labels.time}: ${formatTime(bookingTime)}\n\n${tt.labels.ownerChoose}`;

      await getOrCreateSession(supabase, ownerPhone);
      await updateSession(supabase, ownerPhone, {
        current_step: "owner_approve_reject",
        pending_booking_id: booking.id,
        selected_station_id: stationId,
      });

      notificationTasks.push(
        sendWhatsAppInteractive(
          ownerPhone,
          ownerMsg,
          [
            { id: "approve_yes", title: tt.ownerButtons.approve },
            { id: "approve_no", title: tt.ownerButtons.reject },
          ],
          settings,
        ),
      );
    }

    await Promise.allSettled(notificationTasks);

    return new Response(
      JSON.stringify({
        success: true,
        bookingId: booking.id,
        bookingNumber: booking.booking_number,
        status: "pending_owner_approval",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : i18n.ar.errors.unexpected;

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
