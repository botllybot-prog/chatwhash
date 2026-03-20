import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getSettings(supabase: any) {
  const { data } = await supabase.from("app_settings").select("key, value");
  const settings: Record<string, string> = {};
  if (data) {
    for (const row of data) {
      settings[row.key] = row.value;
    }
  }
  return settings;
}

async function verifySignature(body: string, signature: string, appSecret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(appSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const hashArray = Array.from(new Uint8Array(sig));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return `sha256=${hashHex}` === signature;
  } catch (e) {
    console.error("Signature verification error:", e);
    return false;
  }
}

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "audio/aac": "aac", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/amr": "amr",
    "audio/ogg": "ogg", "audio/opus": "opus",
    "video/mp4": "mp4", "video/3gp": "3gp",
  };
  return map[mimeType] || mimeType.split("/")[1] || "bin";
}

async function downloadAndStoreMedia(
  mediaId: string, accessToken: string, supabase: any, messageType: string, mimeType?: string
): Promise<string | null> {
  try {
    const mediaInfoRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!mediaInfoRes.ok) return null;
    const mediaInfo = await mediaInfoRes.json();
    const mediaMime = mimeType || mediaInfo.mime_type || "application/octet-stream";
    const fileRes = await fetch(mediaInfo.url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!fileRes.ok) return null;
    const fileBlob = await fileRes.blob();
    const ext = getExtension(mediaMime);
    const filePath = `${messageType}/${mediaId}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("whatsapp-media")
      .upload(filePath, fileBlob, { contentType: mediaMime, upsert: true });
    if (uploadErr) return null;
    const { data: urlData } = supabase.storage.from("whatsapp-media").getPublicUrl(filePath);
    return urlData?.publicUrl || null;
  } catch (e) {
    console.error("Media download/store error:", e);
    return null;
  }
}

// ==================== BOT LOGIC ====================

async function sendWhatsAppMessage(phone: string, message: string, settings: Record<string, string>) {
  const accessToken = settings.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = settings.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) return;

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: message },
      }),
    });
    const data = await res.json();
    return data.messages?.[0]?.id || null;
  } catch (e) {
    console.error("Failed to send bot message:", e);
    return null;
  }
}

async function saveBotMessage(supabase: any, convId: string, content: string, waMessageId: string | null) {
  await supabase.from("messages").insert({
    conversation_id: convId,
    direction: "outbound",
    content,
    message_type: "text",
    whatsapp_message_id: waMessageId,
    status: "sent",
  });
  await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convId);
}

async function getOrCreateSession(supabase: any, phone: string) {
  const { data } = await supabase
    .from("bot_sessions")
    .select("*")
    .eq("customer_phone", phone)
    .maybeSingle();

  if (data && new Date(data.expires_at) > new Date()) {
    return data;
  }

  // Reset or create session
  const sessionData = {
    customer_phone: phone,
    current_step: "idle",
    selected_station_id: null,
    selected_service_id: null,
    selected_date: null,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (data) {
    await supabase.from("bot_sessions").update(sessionData).eq("id", data.id);
    return { ...data, ...sessionData };
  } else {
    const { data: newSession } = await supabase
      .from("bot_sessions")
      .insert(sessionData)
      .select()
      .single();
    return newSession;
  }
}

async function updateSession(supabase: any, phone: string, updates: Record<string, any>) {
  await supabase
    .from("bot_sessions")
    .update({
      ...updates,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("customer_phone", phone);
}

function generateTimeSlots(start: string, end: string, durationMin: number): string[] {
  const slots: string[] = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let current = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (current + durationMin <= endMin) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    current += durationMin;
  }
  return slots;
}

async function handleBotLogic(
  supabase: any, phone: string, content: string, convId: string, settings: Record<string, string>
): Promise<boolean> {
  if (settings.BOT_ENABLED !== "true") return false;

  const session = await getOrCreateSession(supabase, phone);
  if (!session) return false;

  const input = content.trim();

  // "0" resets to main menu from any step
  if (input === "0") {
    await updateSession(supabase, phone, { current_step: "idle", selected_station_id: null, selected_service_id: null, selected_date: null });
    session.current_step = "idle";
  }

  // Check for booking lookup command: "#1234" or "إلغاء" or "حجوزاتي"
  if (input === "حجوزاتي" || input === "حجوزات") {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("booking_number, booking_date, booking_time, status, stations(name), services(name, price)")
      .eq("customer_phone", phone)
      .in("status", ["pending", "confirmed"])
      .order("booking_date", { ascending: true })
      .limit(10);

    if (!bookings || bookings.length === 0) {
      const msg = "لا توجد لديك حجوزات نشطة حالياً.\nأرسل أي رسالة لحجز جديد.";
      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      return true;
    }

    let msg = "📋 حجوزاتك النشطة:\n\n";
    bookings.forEach((b: any) => {
      const statusLabel = b.status === "confirmed" ? "مؤكد ✅" : "قيد الانتظار ⏳";
      msg += `🔢 #${b.booking_number} - ${statusLabel}\n`;
      msg += `   🏪 ${b.stations?.name || "-"}\n`;
      msg += `   🧽 ${b.services?.name || "-"} - ${b.services?.price || 0} د.ع\n`;
      msg += `   📅 ${b.booking_date}${b.booking_time ? " ⏰ " + b.booking_time.substring(0, 5) : ""}\n\n`;
    });
    msg += "لإلغاء حجز أرسل: إلغاء #رقم_الحجز\nمثال: إلغاء #" + bookings[0].booking_number;
    msg += "\n\nلتعديل حجز أرسل: تعديل #رقم_الحجز\nمثال: تعديل #" + bookings[0].booking_number;

    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    return true;
  }

  // Cancel booking: "إلغاء #1234" or "الغاء #1234"
  const cancelMatch = input.match(/^(?:إلغاء|الغاء|cancel)\s*#?(\d+)$/i);
  if (cancelMatch) {
    const bookingNum = parseInt(cancelMatch[1]);
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, booking_number, status, stations(name), services(name)")
      .eq("booking_number", bookingNum)
      .eq("customer_phone", phone)
      .maybeSingle();

    if (!booking) {
      const msg = `❌ لم يتم العثور على حجز برقم #${bookingNum} مرتبط برقمك.\nأرسل "حجوزاتي" لعرض حجوزاتك.`;
      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      return true;
    }

    if (booking.status === "cancelled") {
      const msg = `⚠️ الحجز #${bookingNum} ملغي مسبقاً.`;
      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      return true;
    }

    if (booking.status === "completed") {
      const msg = `⚠️ الحجز #${bookingNum} مكتمل ولا يمكن إلغاؤه.`;
      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      return true;
    }

    // Store booking number in session for confirmation
    await updateSession(supabase, phone, {
      current_step: "confirm_cancel",
      selected_station_id: null,
      selected_service_id: null,
      selected_date: String(bookingNum),
    });

    const msg = `⚠️ هل تريد إلغاء الحجز التالي؟\n\n🔢 رقم الحجز: #${bookingNum}\n🏪 المحطة: ${booking.stations?.name || "-"}\n🧽 الخدمة: ${booking.services?.name || "-"}\n\nأرسل "نعم" للتأكيد\nأرسل "لا" للتراجع`;
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    return true;
  }

  // Modify booking: "تعديل #1234"
  const modifyMatch = input.match(/^(?:تعديل|modify)\s*#?(\d+)$/i);
  if (modifyMatch) {
    const bookingNum = parseInt(modifyMatch[1]);
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, booking_number, status, station_id, service_id, stations(name), services(name, price)")
      .eq("booking_number", bookingNum)
      .eq("customer_phone", phone)
      .maybeSingle();

    if (!booking) {
      const msg = `❌ لم يتم العثور على حجز برقم #${bookingNum} مرتبط برقمك.\nأرسل "حجوزاتي" لعرض حجوزاتك.`;
      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      return true;
    }

    if (booking.status === "cancelled" || booking.status === "completed") {
      const msg = `⚠️ الحجز #${bookingNum} ${booking.status === "cancelled" ? "ملغي" : "مكتمل"} ولا يمكن تعديله.`;
      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      return true;
    }

    // Ask what to modify
    await updateSession(supabase, phone, {
      current_step: "modify_choice",
      selected_station_id: booking.station_id,
      selected_service_id: booking.service_id,
      selected_date: String(bookingNum),
    });

    const msg = `✏️ تعديل الحجز #${bookingNum}\n\n🏪 المحطة: ${booking.stations?.name}\n🧽 الخدمة: ${booking.services?.name}\n\nماذا تريد تعديل؟\n1. تغيير الخدمة\n2. تغيير الموعد\n3. إلغاء الحجز\n\nأرسل 0 للعودة`;
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    return true;
  }

  const step = session.current_step;

  // Handle cancel confirmation
  if (step === "confirm_cancel") {
    const bookingNum = parseInt(session.selected_date);
    if (input === "نعم" || input === "اي" || input === "أي" || input === "yes") {
      await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("booking_number", bookingNum)
        .eq("customer_phone", phone);

      const msg = `✅ تم إلغاء الحجز #${bookingNum} بنجاح.\nأرسل أي رسالة لحجز جديد.`;
      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      await updateSession(supabase, phone, { current_step: "idle", selected_station_id: null, selected_service_id: null, selected_date: null });
      return true;
    } else {
      const msg = "تم التراجع عن الإلغاء. ✅\nأرسل أي رسالة للمتابعة.";
      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      await updateSession(supabase, phone, { current_step: "idle", selected_station_id: null, selected_service_id: null, selected_date: null });
      return true;
    }
  }

  // Handle modify choice
  if (step === "modify_choice") {
    const bookingNum = parseInt(session.selected_date);
    const stationId = session.selected_station_id;

    if (input === "1") {
      // Change service
      const { data: services } = await supabase
        .from("services")
        .select("id, name, price")
        .eq("is_active", true)
        .or(`station_id.eq.${stationId},station_id.is.null`)
        .order("sort_order");

      if (!services || services.length === 0) {
        const msg = "عذراً، لا توجد خدمات متاحة حالياً.\nأرسل 0 للعودة";
        const waId = await sendWhatsAppMessage(phone, msg, settings);
        await saveBotMessage(supabase, convId, msg, waId);
        return true;
      }

      let msg = `اختر الخدمة الجديدة للحجز #${bookingNum}:\n\n`;
      services.forEach((s: any, i: number) => {
        msg += `${i + 1}. ${s.name} - ${s.price} د.ع\n`;
      });
      msg += "\nأرسل 0 للعودة";

      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      await updateSession(supabase, phone, { current_step: "modify_service" });
      return true;
    }

    if (input === "2") {
      // Change time - get station scheduling type
      const { data: station } = await supabase.from("stations").select("*").eq("id", stationId).single();

      if (station.scheduling_type === "instant") {
        const msg = "هذه المحطة تعمل بنظام الحجز الفوري ولا يمكن تغيير الموعد.\nأرسل 0 للعودة";
        const waId = await sendWhatsAppMessage(phone, msg, settings);
        await saveBotMessage(supabase, convId, msg, waId);
        return true;
      }

      if (station.scheduling_type === "daily") {
        const days = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date();
          d.setDate(d.getDate() + i);
          const label = i === 0 ? "اليوم" : i === 1 ? "غداً" : d.toLocaleDateString("ar-IQ", { calendar: "gregory", weekday: "long", month: "short", day: "numeric" });
          days.push({ label });
        }
        let msg = `اختر اليوم الجديد للحجز #${bookingNum}:\n\n`;
        days.forEach((d, i) => { msg += `${i + 1}. ${d.label}\n`; });
        msg += "\nأرسل 0 للعودة";

        const waId = await sendWhatsAppMessage(phone, msg, settings);
        await saveBotMessage(supabase, convId, msg, waId);
        await updateSession(supabase, phone, { current_step: "modify_day" });
        return true;
      }

      // Slots
      const today = new Date().toISOString().split("T")[0];
      const allSlots = generateTimeSlots(station.working_hours_start, station.working_hours_end, station.slot_duration_minutes);
      const { data: bookedToday } = await supabase
        .from("bookings").select("booking_time").eq("station_id", stationId).eq("booking_date", today).in("status", ["pending", "confirmed"]);
      const bookedTimes = new Set((bookedToday || []).map((b: any) => b.booking_time?.substring(0, 5)));
      const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
      const available = allSlots.filter((s) => {
        const [h, m] = s.split(":").map(Number);
        return h * 60 + m > nowMinutes && !bookedTimes.has(s);
      });

      if (available.length === 0) {
        const msg = "عذراً، لا توجد مواعيد متاحة اليوم.\nأرسل 0 للعودة";
        const waId = await sendWhatsAppMessage(phone, msg, settings);
        await saveBotMessage(supabase, convId, msg, waId);
        return true;
      }

      let msg = `اختر الموعد الجديد للحجز #${bookingNum}:\n\n`;
      available.forEach((s, i) => { msg += `${i + 1}. ${s}\n`; });
      msg += "\nأرسل 0 للعودة";

      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      await updateSession(supabase, phone, { current_step: "modify_time" });
      return true;
    }

    if (input === "3") {
      // Cancel from modify menu
      await updateSession(supabase, phone, { current_step: "confirm_cancel" });
      const msg = `⚠️ هل تريد إلغاء الحجز #${bookingNum}؟\n\nأرسل "نعم" للتأكيد\nأرسل "لا" للتراجع`;
      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      return true;
    }

    const msg = "❌ اختيار غير صحيح. أرسل 1 أو 2 أو 3\nأرسل 0 للعودة";
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    return true;
  }

  // Handle modify service selection
  if (step === "modify_service") {
    const bookingNum = parseInt(session.selected_date);
    const stationId = session.selected_station_id;

    const { data: services } = await supabase
      .from("services").select("id, name, price").eq("is_active", true)
      .or(`station_id.eq.${stationId},station_id.is.null`).order("sort_order");

    const idx = parseInt(input) - 1;
    if (isNaN(idx) || !services || idx < 0 || idx >= services.length) {
      const msg = `❌ اختيار غير صحيح. أرسل رقم من 1 إلى ${services?.length || 0}\nأرسل 0 للعودة`;
      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      return true;
    }

    const newService = services[idx];
    await supabase.from("bookings").update({ service_id: newService.id }).eq("booking_number", bookingNum).eq("customer_phone", phone);

    const msg = `✅ تم تعديل الحجز #${bookingNum}\n🧽 الخدمة الجديدة: ${newService.name} - ${newService.price} د.ع\n\nأرسل أي رسالة للمتابعة.`;
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    await updateSession(supabase, phone, { current_step: "idle", selected_station_id: null, selected_service_id: null, selected_date: null });
    return true;
  }

  // Handle modify day selection
  if (step === "modify_day") {
    const bookingNum = parseInt(session.selected_date);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push(d.toISOString().split("T")[0]);
    }

    const idx = parseInt(input) - 1;
    if (isNaN(idx) || idx < 0 || idx >= days.length) {
      const msg = `❌ اختيار غير صحيح. أرسل رقم من 1 إلى ${days.length}\nأرسل 0 للعودة`;
      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      return true;
    }

    const newDate = days[idx];
    await supabase.from("bookings").update({ booking_date: newDate }).eq("booking_number", bookingNum).eq("customer_phone", phone);

    const dateLabel = new Date(newDate).toLocaleDateString("ar-IQ", { calendar: "gregory", weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const msg = `✅ تم تعديل الحجز #${bookingNum}\n📅 التاريخ الجديد: ${dateLabel}\n\nأرسل أي رسالة للمتابعة.`;
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    await updateSession(supabase, phone, { current_step: "idle", selected_station_id: null, selected_service_id: null, selected_date: null });
    return true;
  }

  // Handle modify time selection
  if (step === "modify_time") {
    const bookingNum = parseInt(session.selected_date);
    const stationId = session.selected_station_id;

    const { data: station } = await supabase.from("stations").select("*").eq("id", stationId).single();
    const today = new Date().toISOString().split("T")[0];
    const allSlots = generateTimeSlots(station.working_hours_start, station.working_hours_end, station.slot_duration_minutes);
    const { data: bookedToday } = await supabase
      .from("bookings").select("booking_time").eq("station_id", stationId).eq("booking_date", today).in("status", ["pending", "confirmed"]);
    const bookedTimes = new Set((bookedToday || []).map((b: any) => b.booking_time?.substring(0, 5)));
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const available = allSlots.filter((s) => {
      const [h, m] = s.split(":").map(Number);
      return h * 60 + m > nowMinutes && !bookedTimes.has(s);
    });

    const idx = parseInt(input) - 1;
    if (isNaN(idx) || idx < 0 || idx >= available.length) {
      const msg = `❌ اختيار غير صحيح. أرسل رقم من 1 إلى ${available.length}\nأرسل 0 للعودة`;
      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      return true;
    }

    const newTime = available[idx];
    await supabase.from("bookings").update({ booking_time: newTime, booking_date: today }).eq("booking_number", bookingNum).eq("customer_phone", phone);

    const msg = `✅ تم تعديل الحجز #${bookingNum}\n⏰ الموعد الجديد: اليوم ${newTime}\n\nأرسل أي رسالة للمتابعة.`;
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    await updateSession(supabase, phone, { current_step: "idle", selected_station_id: null, selected_service_id: null, selected_date: null });
    return true;
  }

  if (step === "idle") {
    // Show stations
    const { data: stations } = await supabase
      .from("stations")
      .select("id, name, address")
      .eq("is_active", true)
      .order("created_at");

    if (!stations || stations.length === 0) {
      const msg = "عذراً، لا توجد محطات متاحة حالياً. يرجى المحاولة لاحقاً.";
      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      return true;
    }

    const welcome = settings.BOT_WELCOME_MESSAGE || "مرحباً بك في خدمة غسيل السيارات! 🚗✨";
    let msg = `${welcome}\n\nاختر المحطة:\n`;
    stations.forEach((s: any, i: number) => {
      msg += `${i + 1}. ${s.name}${s.address ? ` - ${s.address}` : ""}\n`;
    });
    msg += "\nأرسل رقم المحطة للاختيار\nأرسل \"حجوزاتي\" لعرض حجوزاتك\nأرسل \"إلغاء #رقم\" لإلغاء حجز\nأرسل \"تعديل #رقم\" لتعديل حجز";

    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    await updateSession(supabase, phone, { current_step: "awaiting_station" });
    return true;
  }

  if (step === "awaiting_station") {
    const { data: stations } = await supabase
      .from("stations")
      .select("id, name")
      .eq("is_active", true)
      .order("created_at");

    const idx = parseInt(input) - 1;
    if (isNaN(idx) || !stations || idx < 0 || idx >= stations.length) {
      const msg = `❌ اختيار غير صحيح. أرسل رقم من 1 إلى ${stations?.length || 0}\nأرسل 0 للعودة للقائمة الرئيسية`;
      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      return true;
    }

    const station = stations[idx];
    const { data: services } = await supabase
      .from("services")
      .select("id, name, price")
      .eq("is_active", true)
      .or(`station_id.eq.${station.id},station_id.is.null`)
      .order("sort_order");

    if (!services || services.length === 0) {
      const msg = `عذراً، لا توجد خدمات متاحة في ${station.name} حالياً.\nأرسل 0 للعودة للقائمة الرئيسية`;
      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      return true;
    }

    let msg = `✅ اخترت: ${station.name}\n\nاختر الخدمة:\n`;
    services.forEach((s: any, i: number) => {
      msg += `${i + 1}. ${s.name} - ${s.price} د.ع\n`;
    });
    msg += "\nأرسل رقم الخدمة للاختيار\nأرسل 0 للعودة للقائمة الرئيسية";

    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    await updateSession(supabase, phone, { current_step: "awaiting_service", selected_station_id: station.id });
    return true;
  }

  if (step === "awaiting_service") {
    const stationId = session.selected_station_id;
    const { data: services } = await supabase
      .from("services")
      .select("id, name, price")
      .eq("is_active", true)
      .or(`station_id.eq.${stationId},station_id.is.null`)
      .order("sort_order");

    const idx = parseInt(input) - 1;
    if (isNaN(idx) || !services || idx < 0 || idx >= services.length) {
      const msg = `❌ اختيار غير صحيح. أرسل رقم من 1 إلى ${services?.length || 0}\nأرسل 0 للعودة للقائمة الرئيسية`;
      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      return true;
    }

    const service = services[idx];
    const { data: station } = await supabase.from("stations").select("*").eq("id", stationId).single();

    if (station.scheduling_type === "instant") {
      const today = new Date().toISOString().split("T")[0];
      const nowTime = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });

      const { data: booking } = await supabase
        .from("bookings")
        .insert({
          customer_phone: phone,
          station_id: stationId,
          service_id: service.id,
          booking_date: today,
          booking_time: nowTime,
          status: "confirmed",
        })
        .select("booking_number")
        .single();

      const msg = `✅ تم الحجز بنجاح!\n\n📋 تفاصيل الحجز:\n🏪 المحطة: ${station.name}\n🧽 الخدمة: ${service.name}\n💰 السعر: ${service.price} د.ع\n📅 التاريخ: اليوم\n⏰ الوقت: الآن\n🔢 رقم الحجز: #${booking?.booking_number || "---"}\n\nشكراً لاختيارك خدمتنا! 🚗✨\nأرسل أي رسالة لحجز جديد`;
      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      await updateSession(supabase, phone, { current_step: "idle", selected_station_id: null, selected_service_id: null, selected_date: null });
      return true;
    }

    if (station.scheduling_type === "daily") {
      const days = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const label = i === 0 ? "اليوم" : i === 1 ? "غداً" : d.toLocaleDateString("ar-IQ", { calendar: "gregory", weekday: "long", month: "short", day: "numeric" });
        days.push({ date: d.toISOString().split("T")[0], label });
      }

      let msg = `✅ اخترت: ${service.name} - ${service.price} د.ع\n\nاختر اليوم:\n`;
      days.forEach((d, i) => {
        msg += `${i + 1}. ${d.label}\n`;
      });
      msg += "\nأرسل رقم اليوم للاختيار\nأرسل 0 للعودة للقائمة الرئيسية";

      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      await updateSession(supabase, phone, { current_step: "awaiting_day", selected_service_id: service.id });
      return true;
    }

    // Default: slots
    const today = new Date().toISOString().split("T")[0];
    const allSlots = generateTimeSlots(station.working_hours_start, station.working_hours_end, station.slot_duration_minutes);

    const { data: bookedToday } = await supabase
      .from("bookings")
      .select("booking_time")
      .eq("station_id", stationId)
      .eq("booking_date", today)
      .in("status", ["pending", "confirmed"]);

    const bookedTimes = new Set((bookedToday || []).map((b: any) => b.booking_time?.substring(0, 5)));
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const available = allSlots.filter((s) => {
      const [h, m] = s.split(":").map(Number);
      return h * 60 + m > nowMinutes && !bookedTimes.has(s);
    });

    if (available.length === 0) {
      const msg = `عذراً، لا توجد مواعيد متاحة اليوم في ${station.name}.\nأرسل 0 للعودة للقائمة الرئيسية`;
      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      return true;
    }

    let msg = `✅ اخترت: ${service.name} - ${service.price} د.ع\n\nالمواعيد المتاحة اليوم:\n`;
    available.forEach((s, i) => {
      msg += `${i + 1}. ${s}\n`;
    });
    msg += "\nأرسل رقم الموعد للاختيار\nأرسل 0 للعودة للقائمة الرئيسية";

    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    await updateSession(supabase, phone, { current_step: "awaiting_time", selected_service_id: service.id, selected_date: today });
    return true;
  }

  if (step === "awaiting_day") {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push(d.toISOString().split("T")[0]);
    }

    const idx = parseInt(input) - 1;
    if (isNaN(idx) || idx < 0 || idx >= days.length) {
      const msg = `❌ اختيار غير صحيح. أرسل رقم من 1 إلى ${days.length}\nأرسل 0 للعودة للقائمة الرئيسية`;
      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      return true;
    }

    const selectedDate = days[idx];
    const stationId = session.selected_station_id;
    const serviceId = session.selected_service_id;

    const { data: station } = await supabase.from("stations").select("name").eq("id", stationId).single();
    const { data: service } = await supabase.from("services").select("name, price").eq("id", serviceId).single();

    const { data: booking } = await supabase
      .from("bookings")
      .insert({
        customer_phone: phone,
        station_id: stationId,
        service_id: serviceId,
        booking_date: selectedDate,
        status: "confirmed",
      })
      .select("booking_number")
      .single();

    const dateLabel = new Date(selectedDate).toLocaleDateString("ar-IQ", { calendar: "gregory", weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const msg = `✅ تم الحجز بنجاح!\n\n📋 تفاصيل الحجز:\n🏪 المحطة: ${station?.name}\n🧽 الخدمة: ${service?.name}\n💰 السعر: ${service?.price} د.ع\n📅 التاريخ: ${dateLabel}\n🔢 رقم الحجز: #${booking?.booking_number || "---"}\n\nشكراً لاختيارك خدمتنا! 🚗✨\nأرسل أي رسالة لحجز جديد`;
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    await updateSession(supabase, phone, { current_step: "idle", selected_station_id: null, selected_service_id: null, selected_date: null });
    return true;
  }

  if (step === "awaiting_time") {
    const stationId = session.selected_station_id;
    const serviceId = session.selected_service_id;
    const bookingDate = session.selected_date;

    const { data: station } = await supabase.from("stations").select("*").eq("id", stationId).single();
    const allSlots = generateTimeSlots(station.working_hours_start, station.working_hours_end, station.slot_duration_minutes);

    const { data: bookedToday } = await supabase
      .from("bookings")
      .select("booking_time")
      .eq("station_id", stationId)
      .eq("booking_date", bookingDate)
      .in("status", ["pending", "confirmed"]);

    const bookedTimes = new Set((bookedToday || []).map((b: any) => b.booking_time?.substring(0, 5)));
    const isToday = bookingDate === new Date().toISOString().split("T")[0];
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

    const available = allSlots.filter((s) => {
      const [h, m] = s.split(":").map(Number);
      if (isToday && h * 60 + m <= nowMinutes) return false;
      return !bookedTimes.has(s);
    });

    const idx = parseInt(input) - 1;
    if (isNaN(idx) || idx < 0 || idx >= available.length) {
      const msg = `❌ اختيار غير صحيح. أرسل رقم من 1 إلى ${available.length}\nأرسل 0 للعودة للقائمة الرئيسية`;
      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      return true;
    }

    const selectedTime = available[idx];
    const { data: service } = await supabase.from("services").select("name, price").eq("id", serviceId).single();

    const { data: booking } = await supabase
      .from("bookings")
      .insert({
        customer_phone: phone,
        station_id: stationId,
        service_id: serviceId,
        booking_date: bookingDate,
        booking_time: selectedTime,
        status: "confirmed",
      })
      .select("booking_number")
      .single();

    const dateLabel = new Date(bookingDate).toLocaleDateString("ar-IQ", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const msg = `✅ تم الحجز بنجاح!\n\n📋 تفاصيل الحجز:\n🏪 المحطة: ${station.name}\n🧽 الخدمة: ${service?.name}\n💰 السعر: ${service?.price} د.ع\n📅 التاريخ: ${dateLabel}\n⏰ الوقت: ${selectedTime}\n🔢 رقم الحجز: #${booking?.booking_number || "---"}\n\nشكراً لاختيارك خدمتنا! 🚗✨\nأرسل أي رسالة لحجز جديد`;
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    await updateSession(supabase, phone, { current_step: "idle", selected_station_id: null, selected_service_id: null, selected_date: null });
    return true;
  }

  // Unknown step - reset
  await updateSession(supabase, phone, { current_step: "idle" });
  return false;
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const settings = await getSettings(supabase);

  // GET: Webhook verification
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === settings.WHATSAPP_VERIFY_TOKEN) {
      console.log("Webhook verified");
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // POST: Incoming messages
  if (req.method === "POST") {
    const bodyText = await req.text();

    if (settings.WHATSAPP_APP_SECRET) {
      const signature = req.headers.get("x-hub-signature-256") || "";
      const valid = await verifySignature(bodyText, signature, settings.WHATSAPP_APP_SECRET);
      if (!valid) {
        console.error("Invalid webhook signature");
        return new Response(JSON.stringify({ success: false, reason: "invalid_signature" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let body: any;
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      console.error("Failed to parse webhook body:", e);
      return new Response(JSON.stringify({ success: false }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value;

          // Handle status updates
          if (value.statuses) {
            for (const status of value.statuses) {
              const waMessageId = status.id;
              const newStatus = status.status;
              console.log(`Status update: ${waMessageId} -> ${newStatus}`);
              await supabase.from("messages").update({ status: newStatus }).eq("whatsapp_message_id", waMessageId);
            }
          }

          // Handle incoming messages
          if (value.messages) {
            for (const msg of value.messages) {
              const phone = msg.from;
              const contactName = value.contacts?.[0]?.profile?.name || phone;
              const messageType = msg.type || "text";

              let content = "";
              let mediaId: string | null = null;
              let mediaMime: string | undefined;

              switch (msg.type) {
                case "text": content = msg.text?.body || ""; break;
                case "image": content = msg.image?.caption || "📷 صورة"; mediaId = msg.image?.id; mediaMime = msg.image?.mime_type; break;
                case "audio": content = "🎵 رسالة صوتية"; mediaId = msg.audio?.id; mediaMime = msg.audio?.mime_type; break;
                case "video": content = msg.video?.caption || "🎥 فيديو"; mediaId = msg.video?.id; mediaMime = msg.video?.mime_type; break;
                case "document": content = msg.document?.filename || "📄 مستند"; mediaId = msg.document?.id; mediaMime = msg.document?.mime_type; break;
                case "sticker": content = "😊 ملصق"; mediaId = msg.sticker?.id; mediaMime = msg.sticker?.mime_type; break;
                case "location": content = "📍 موقع"; break;
                case "contacts": content = "👤 جهة اتصال"; break;
                default: content = msg.type || "";
              }

              const now = new Date().toISOString();
              console.log(`Incoming ${messageType} from ${phone}: ${content.substring(0, 50)}`);

              // Check for duplicate
              if (msg.id) {
                const { data: existingMsg } = await supabase
                  .from("messages").select("id").eq("whatsapp_message_id", msg.id).maybeSingle();
                if (existingMsg) { console.log(`Duplicate skipped: ${msg.id}`); continue; }
              }

              // Download media
              let mediaUrl: string | null = null;
              if (mediaId && settings.WHATSAPP_ACCESS_TOKEN) {
                mediaUrl = await downloadAndStoreMedia(mediaId, settings.WHATSAPP_ACCESS_TOKEN, supabase, messageType, mediaMime);
              }

              // Find or create conversation
              let convId: string;
              const { data: existingConv } = await supabase
                .from("conversations").select("id").eq("customer_phone", phone).eq("status", "open").limit(1).maybeSingle();

              if (existingConv) {
                convId = existingConv.id;
                await supabase.from("conversations").update({ last_message_at: now, customer_name: contactName }).eq("id", convId);
              } else {
                const { data: newConv, error: newConvErr } = await supabase
                  .from("conversations")
                  .insert({ customer_phone: phone, customer_name: contactName, status: "open", last_message_at: now })
                  .select("id").single();

                if (newConvErr || !newConv) {
                  const { data: retryConv } = await supabase
                    .from("conversations").select("id").eq("customer_phone", phone).eq("status", "open").limit(1).maybeSingle();
                  if (!retryConv) continue;
                  convId = retryConv.id;
                } else {
                  convId = newConv.id;
                }
              }

              // Insert message
              await supabase.from("messages").insert({
                conversation_id: convId,
                direction: "inbound",
                content,
                message_type: messageType,
                whatsapp_message_id: msg.id,
                status: "delivered",
                media_url: mediaUrl,
              });

              // Handle bot logic (only for text messages)
              if (messageType === "text") {
                await handleBotLogic(supabase, phone, content, convId, settings);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error processing webhook:", error);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
});
