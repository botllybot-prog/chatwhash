import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ==================== HELPERS ====================

async function getSettings(supabase: any) {
  const { data } = await supabase.from("app_settings").select("key, value");
  const settings: Record<string, string> = {};
  if (data) for (const row of data) settings[row.key] = row.value;
  return settings;
}

async function verifySignature(body: string, signature: string, appSecret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const hashHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
    return `sha256=${hashHex}` === signature;
  } catch { return false; }
}

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "audio/aac": "aac", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/amr": "amr",
    "audio/ogg": "ogg", "audio/opus": "opus", "video/mp4": "mp4", "video/3gp": "3gp",
  };
  return map[mimeType] || mimeType.split("/")[1] || "bin";
}

async function downloadAndStoreMedia(mediaId: string, accessToken: string, supabase: any, messageType: string, mimeType?: string): Promise<string | null> {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return null;
    const info = await res.json();
    const mime = mimeType || info.mime_type || "application/octet-stream";
    const fileRes = await fetch(info.url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!fileRes.ok) return null;
    const blob = await fileRes.blob();
    const path = `${messageType}/${mediaId}.${getExtension(mime)}`;
    const { error } = await supabase.storage.from("whatsapp-media").upload(path, blob, { contentType: mime, upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
    return data?.publicUrl || null;
  } catch { return null; }
}

// ==================== MESSAGING ====================

async function sendWhatsAppMessage(phone: string, message: string, settings: Record<string, string>) {
  const token = settings.WHATSAPP_ACCESS_TOKEN;
  const phoneId = settings.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return null;
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: message } }),
    });
    const data = await res.json();
    return data.messages?.[0]?.id || null;
  } catch { return null; }
}

async function sendWhatsAppInteractive(phone: string, body: string, buttons: { id: string; title: string }[], settings: Record<string, string>) {
  const token = settings.WHATSAPP_ACCESS_TOKEN;
  const phoneId = settings.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return null;
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: phone, type: "interactive",
        interactive: {
          type: "button", body: { text: body },
          action: { buttons: buttons.map(b => ({ type: "reply", reply: { id: b.id, title: b.title } })) },
        },
      }),
    });
    const data = await res.json();
    return data.messages?.[0]?.id || null;
  } catch { return null; }
}

async function saveBotMessage(supabase: any, convId: string, content: string, waMessageId: string | null) {
  await supabase.from("messages").insert({
    conversation_id: convId, direction: "outbound", content, message_type: "text",
    whatsapp_message_id: waMessageId, status: "sent", platform: "whatsapp",
  });
  await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convId);
}

// ==================== SESSION ====================

async function getOrCreateSession(supabase: any, phone: string) {
  const { data } = await supabase.from("bot_sessions").select("*").eq("customer_phone", phone).maybeSingle();
  if (data && new Date(data.expires_at) > new Date()) return data;
  const sessionData = {
    customer_phone: phone, current_step: "idle",
    selected_station_id: null, selected_service_id: null, selected_date: null, pending_booking_id: null,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), updated_at: new Date().toISOString(),
  };
  if (data) {
    await supabase.from("bot_sessions").update(sessionData).eq("id", data.id);
    return { ...data, ...sessionData };
  }
  const { data: ns } = await supabase.from("bot_sessions").insert(sessionData).select().single();
  return ns;
}

async function updateSession(supabase: any, phone: string, updates: Record<string, any>) {
  await supabase.from("bot_sessions").update({
    ...updates, expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), updated_at: new Date().toISOString(),
  }).eq("customer_phone", phone);
}

// ==================== UTILITIES ====================

function generateTimeSlots(start: string, end: string, durationMin: number): string[] {
  const slots: string[] = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let cur = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (cur + durationMin <= endMin) {
    slots.push(`${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`);
    cur += durationMin;
  }
  return slots;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getCustomerName(supabase: any, convId: string): Promise<string | null> {
  const { data } = await supabase.from("conversations").select("customer_name").eq("id", convId).single();
  return data?.customer_name || null;
}

async function getOrCreateConvForPhone(supabase: any, phone: string, name?: string): Promise<string | null> {
  const { data: existing } = await supabase.from("conversations").select("id").eq("customer_phone", phone).eq("status", "open").maybeSingle();
  if (existing) return existing.id;
  const { data: newConv } = await supabase.from("conversations")
    .insert({ customer_phone: phone, customer_name: name || phone, status: "open", last_message_at: new Date().toISOString(), platform: "whatsapp" })
    .select("id").single();
  return newConv?.id || null;
}

// ==================== CHECK IF OWNER ====================

async function checkIfOwner(supabase: any, phone: string) {
  const { data } = await supabase.from("station_owners")
    .select("id, owner_name, station_id, stations(name)")
    .eq("owner_phone", phone).maybeSingle();
  return data;
}

// ==================== OWNER BOT LOGIC ====================

async function handleOwnerLogic(
  supabase: any, phone: string, content: string, convId: string, settings: Record<string, string>, owner: any
): Promise<boolean> {
  const session = await getOrCreateSession(supabase, phone);
  if (!session) return false;
  const input = content.trim();
  const step = session.current_step;

  // Reset
  if (input === "0") {
    await updateSession(supabase, phone, { current_step: "owner_idle", selected_station_id: null, pending_booking_id: null });
    return await showOwnerMenu(supabase, phone, convId, settings, owner);
  }

  // Owner idle - show menu
  if (step === "idle" || step === "owner_idle") {
    return await showOwnerMenu(supabase, phone, convId, settings, owner);
  }

  // Owner accepting a booking
  if (step === "owner_approve_reject") {
    const bookingId = session.pending_booking_id;
    if (!bookingId) {
      await updateSession(supabase, phone, { current_step: "owner_idle" });
      return await showOwnerMenu(supabase, phone, convId, settings, owner);
    }

    if (input === "موافق" || input === "approve_yes") {
      // Ask for offer
      await updateSession(supabase, phone, { current_step: "owner_offer" });
      const msg = "✅ تمت الموافقة!\n\nهل يوجد عرض خاص ترغب بإرفاقه للعميل اليوم؟\n(اكتب العرض أو أرسل \"لا\" للتخطي)";
      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      return true;
    }

    if (input === "رفض" || input === "approve_no") {
      // Reject booking
      await supabase.from("bookings").update({ status: "cancelled" }).eq("id", bookingId);

      // Notify customer
      const { data: booking } = await supabase.from("bookings")
        .select("customer_phone, booking_number, stations(name)").eq("id", bookingId).single();
      if (booking) {
        const custConvId = await getOrCreateConvForPhone(supabase, booking.customer_phone);
        if (custConvId) {
          const custMsg = `❌ عذراً، تم رفض حجزك #${booking.booking_number} في ${booking.stations?.name}.\n\nيمكنك حجز موعد آخر بإرسال أي رسالة.`;
          const custWaId = await sendWhatsAppMessage(booking.customer_phone, custMsg, settings);
          await saveBotMessage(supabase, custConvId, custMsg, custWaId);
        }
      }

      await updateSession(supabase, phone, { current_step: "owner_idle", pending_booking_id: null });
      const msg = "✅ تم رفض الحجز وإبلاغ العميل.\n\nأرسل أي رسالة لعرض القائمة.";
      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      return true;
    }

    const msg = "❌ أرسل \"موافق\" أو \"رفض\"";
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    return true;
  }

  // Owner adding offer
  if (step === "owner_offer") {
    const bookingId = session.pending_booking_id;
    const offer = (input === "لا" || input === "no") ? null : input;
    if (offer) await supabase.from("bookings").update({ owner_offer: offer }).eq("id", bookingId);

    await updateSession(supabase, phone, { current_step: "owner_note" });
    const msg = "هل توجد ملاحظة إضافية للعميل؟\n(اكتب الملاحظة أو أرسل \"لا\" للتخطي)";
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    return true;
  }

  // Owner adding note
  if (step === "owner_note") {
    const bookingId = session.pending_booking_id;
    const note = (input === "لا" || input === "no") ? null : input;
    if (note) await supabase.from("bookings").update({ owner_note: note }).eq("id", bookingId);

    // Confirm booking
    await supabase.from("bookings").update({ status: "confirmed" }).eq("id", bookingId);

    // Send final confirmation to customer
    const { data: booking } = await supabase.from("bookings")
      .select("booking_number, customer_phone, booking_date, booking_time, owner_offer, owner_note, stations(name), services(name, price)")
      .eq("id", bookingId).single();

    if (booking) {
      const custConvId = await getOrCreateConvForPhone(supabase, booking.customer_phone);
      if (custConvId) {
        let custMsg = `✅ تم تأكيد حجزك بنجاح!\n\n🔢 رقم الحجز: #${booking.booking_number}\n🏪 المغسلة: ${booking.stations?.name}\n🧽 الخدمة: ${booking.services?.name}\n💰 السعر: ${booking.services?.price} د.ع\n📅 التاريخ: ${booking.booking_date}`;
        if (booking.booking_time) custMsg += `\n⏰ الوقت: ${booking.booking_time.substring(0, 5)}`;
        if (booking.owner_offer) custMsg += `\n\n🎁 عرض خاص لك اليوم: ${booking.owner_offer}`;
        if (booking.owner_note) custMsg += `\n📝 ملاحظة من الإدارة: ${booking.owner_note}`;
        custMsg += "\n\nنتمنى لك تجربة رائعة! 🚗✨";

        const custWaId = await sendWhatsAppMessage(booking.customer_phone, custMsg, settings);
        await saveBotMessage(supabase, custConvId, custMsg, custWaId);
      }
    }

    await updateSession(supabase, phone, { current_step: "owner_idle", pending_booking_id: null });
    const msg = "✅ تم تأكيد الحجز وإرسال التفاصيل للعميل.\n\nأرسل أي رسالة لعرض القائمة.";
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    return true;
  }

  // Owner viewing pending bookings
  if (step === "owner_view_pending") {
    const { data: pendingBookings } = await supabase.from("bookings")
      .select("id, booking_number, customer_phone, customer_name, booking_date, booking_time, services(name, price)")
      .eq("station_id", owner.station_id).eq("status", "pending").order("created_at");

    const idx = parseInt(input) - 1;
    if (isNaN(idx) || !pendingBookings || idx < 0 || idx >= pendingBookings.length) {
      const msg = `❌ اختيار غير صحيح. أرسل رقم من 1 إلى ${pendingBookings?.length || 0}\nأرسل 0 للعودة`;
      const waId = await sendWhatsAppMessage(phone, msg, settings);
      await saveBotMessage(supabase, convId, msg, waId);
      return true;
    }

    const b = pendingBookings[idx];
    await updateSession(supabase, phone, { current_step: "owner_approve_reject", pending_booking_id: b.id });

    const msg = `📋 تفاصيل الحجز #${b.booking_number}:\n\n📱 العميل: ${b.customer_name || b.customer_phone}\n🧽 الخدمة: ${b.services?.name} - ${b.services?.price} د.ع\n📅 التاريخ: ${b.booking_date}${b.booking_time ? "\n⏰ الوقت: " + b.booking_time.substring(0, 5) : ""}\n\nهل توافق على الحجز؟\nأرسل "موافق" أو "رفض"`;
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    return true;
  }

  // Default: show menu
  return await showOwnerMenu(supabase, phone, convId, settings, owner);
}

async function showOwnerMenu(supabase: any, phone: string, convId: string, settings: Record<string, string>, owner: any) {
  const { data: pendingBookings } = await supabase.from("bookings")
    .select("id, booking_number, customer_name, customer_phone, booking_date, booking_time, services(name)")
    .eq("station_id", owner.station_id).eq("status", "pending").order("created_at");

  const stationName = owner.stations?.name || "محطتك";
  let msg = `مرحباً ${owner.owner_name} 👋\nلوحة إدارة ${stationName}\n\n`;

  if (!pendingBookings || pendingBookings.length === 0) {
    msg += "✅ لا توجد حجوزات معلقة حالياً.\n";
  } else {
    msg += `📋 لديك ${pendingBookings.length} حجز معلق:\n\n`;
    pendingBookings.forEach((b: any, i: number) => {
      msg += `${i + 1}. #${b.booking_number} - ${b.customer_name || b.customer_phone} - ${b.services?.name} - ${b.booking_date}${b.booking_time ? " " + b.booking_time.substring(0, 5) : ""}\n`;
    });
    msg += "\nأرسل رقم الحجز للموافقة أو الرفض";
  }

  const waId = await sendWhatsAppMessage(phone, msg, settings);
  await saveBotMessage(supabase, convId, msg, waId);
  await updateSession(supabase, phone, {
    current_step: pendingBookings && pendingBookings.length > 0 ? "owner_view_pending" : "owner_idle",
    selected_station_id: owner.station_id,
  });
  return true;
}

// ==================== CUSTOMER BOT LOGIC ====================

async function handleCustomerLogic(
  supabase: any, phone: string, content: string, convId: string, settings: Record<string, string>,
  locationData?: { latitude: number; longitude: number }
): Promise<boolean> {
  if (settings.BOT_ENABLED !== "true") return false;

  const session = await getOrCreateSession(supabase, phone);
  if (!session) return false;

  const input = content.trim();

  // "0" resets
  if (input === "0") {
    await updateSession(supabase, phone, { current_step: "idle", selected_station_id: null, selected_service_id: null, selected_date: null, pending_booking_id: null });
    return await showCustomerWelcome(supabase, phone, convId, settings);
  }

  // Check bookings command
  if (input === "حجوزاتي" || input === "حجوزات") {
    return await showMyBookings(supabase, phone, convId, settings);
  }

  // Cancel booking
  const cancelMatch = input.match(/^(?:إلغاء|الغاء|cancel)\s*#?(\d+)$/i);
  if (cancelMatch) return await handleCancelBooking(supabase, phone, convId, settings, parseInt(cancelMatch[1]));

  const step = session.current_step;

  // Handle location message - find nearest station
  if (locationData) {
    return await handleLocationMessage(supabase, phone, convId, settings, locationData);
  }

  // Cancel confirmation
  if (step === "confirm_cancel") return await handleConfirmCancel(supabase, phone, convId, settings, session, input);

  // Waiting for owner response
  if (step === "awaiting_owner_response") {
    const msg = "⏳ حجزك قيد المراجعة من قبل إدارة المغسلة.\nسنبلغك فور الرد.\n\nأرسل 0 للعودة للقائمة الرئيسية\nأرسل \"حجوزاتي\" لعرض حجوزاتك";
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    return true;
  }

  // Idle - welcome with location request
  if (step === "idle") {
    return await showCustomerWelcome(supabase, phone, convId, settings);
  }

  // Awaiting station selection
  if (step === "awaiting_station") return await handleStationSelection(supabase, phone, convId, settings, session, input);

  // Awaiting service
  if (step === "awaiting_service") return await handleServiceSelection(supabase, phone, convId, settings, session, input);

  // Awaiting day
  if (step === "awaiting_day") return await handleDaySelection(supabase, phone, convId, settings, session, input);

  // Awaiting time
  if (step === "awaiting_time") return await handleTimeSelection(supabase, phone, convId, settings, session, input);

  // Unknown step
  await updateSession(supabase, phone, { current_step: "idle" });
  return await showCustomerWelcome(supabase, phone, convId, settings);
}

async function showCustomerWelcome(supabase: any, phone: string, convId: string, settings: Record<string, string>) {
  const welcome = settings.BOT_WELCOME_MESSAGE || "مرحباً بك في خدمة غسيل السيارات! 🚗✨";

  const { data: stations } = await supabase.from("stations").select("id, name, address").eq("is_active", true).order("created_at");

  let msg = `${welcome}\n\n📍 لتحديد أقرب مغسلة إليك، أرسل موقعك عبر زر المشاركة في واتساب.\n\nأو اختر المغسلة يدوياً:\n`;
  if (stations && stations.length > 0) {
    stations.forEach((s: any, i: number) => {
      msg += `${i + 1}. ${s.name}${s.address ? ` - ${s.address}` : ""}\n`;
    });
  } else {
    msg += "عذراً، لا توجد مغاسل متاحة حالياً.\n";
  }
  msg += "\nأرسل \"حجوزاتي\" لعرض حجوزاتك";

  const waId = await sendWhatsAppMessage(phone, msg, settings);
  await saveBotMessage(supabase, convId, msg, waId);
  await updateSession(supabase, phone, { current_step: "awaiting_station" });
  return true;
}

async function handleLocationMessage(supabase: any, phone: string, convId: string, settings: Record<string, string>, loc: { latitude: number; longitude: number }) {
  const { data: stations } = await supabase.from("stations")
    .select("id, name, address, latitude, longitude").eq("is_active", true);

  if (!stations || stations.length === 0) {
    const msg = "عذراً، لا توجد مغاسل متاحة حالياً.";
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    return true;
  }

  // Calculate distances
  const withDist = stations
    .filter((s: any) => s.latitude && s.longitude)
    .map((s: any) => ({ ...s, distance: haversineDistance(loc.latitude, loc.longitude, s.latitude, s.longitude) }))
    .sort((a: any, b: any) => a.distance - b.distance);

  if (withDist.length === 0) {
    // No stations with coordinates, show all
    return await showCustomerWelcome(supabase, phone, convId, settings);
  }

  const nearest = withDist[0];
  const distKm = nearest.distance.toFixed(1);
  const mapsLink = `https://www.google.com/maps/dir/${loc.latitude},${loc.longitude}/${nearest.latitude},${nearest.longitude}`;

  let msg = `📍 أقرب مغسلة إليك:\n\n🏪 ${nearest.name}${nearest.address ? `\n📌 ${nearest.address}` : ""}\n📏 المسافة: ${distKm} كم\n🗺️ الاتجاهات: ${mapsLink}\n\nأرسل "حجز" للمتابعة مع هذه المغسلة`;

  if (withDist.length > 1) {
    msg += "\n\nأو اختر مغسلة أخرى:\n";
    withDist.slice(1, 4).forEach((s: any, i: number) => {
      msg += `${i + 2}. ${s.name} - ${s.distance.toFixed(1)} كم\n`;
    });
  }
  msg += "\nأرسل 0 للعودة";

  const waId = await sendWhatsAppMessage(phone, msg, settings);
  await saveBotMessage(supabase, convId, msg, waId);
  await updateSession(supabase, phone, { current_step: "awaiting_station_confirm", selected_station_id: nearest.id });
  return true;
}

async function handleStationSelection(supabase: any, phone: string, convId: string, settings: Record<string, string>, session: any, input: string) {
  // Check if coming from location suggestion
  if (session.current_step === "awaiting_station_confirm" || input === "حجز" || input === "1" && session.selected_station_id) {
    // handled below
  }

  const { data: stations } = await supabase.from("stations").select("id, name").eq("is_active", true).order("created_at");
  const idx = parseInt(input) - 1;
  if (isNaN(idx) || !stations || idx < 0 || idx >= stations.length) {
    const msg = `❌ اختيار غير صحيح. أرسل رقم من 1 إلى ${stations?.length || 0}\nأرسل 0 للعودة`;
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    return true;
  }

  return await showServicesForStation(supabase, phone, convId, settings, stations[idx].id, stations[idx].name);
}

async function showServicesForStation(supabase: any, phone: string, convId: string, settings: Record<string, string>, stationId: string, stationName: string) {
  const { data: services } = await supabase.from("services").select("id, name, price")
    .eq("is_active", true).or(`station_id.eq.${stationId},station_id.is.null`).order("sort_order");

  if (!services || services.length === 0) {
    const msg = `عذراً، لا توجد خدمات متاحة في ${stationName} حالياً.\nأرسل 0 للعودة`;
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    return true;
  }

  let msg = `✅ اخترت: ${stationName}\n\nاختر الخدمة:\n`;
  services.forEach((s: any, i: number) => { msg += `${i + 1}. ${s.name} - ${s.price} د.ع\n`; });
  msg += "\nأرسل رقم الخدمة\nأرسل 0 للعودة";

  const waId = await sendWhatsAppMessage(phone, msg, settings);
  await saveBotMessage(supabase, convId, msg, waId);
  await updateSession(supabase, phone, { current_step: "awaiting_service", selected_station_id: stationId });
  return true;
}

async function handleServiceSelection(supabase: any, phone: string, convId: string, settings: Record<string, string>, session: any, input: string) {
  const stationId = session.selected_station_id;
  const { data: services } = await supabase.from("services").select("id, name, price")
    .eq("is_active", true).or(`station_id.eq.${stationId},station_id.is.null`).order("sort_order");

  const idx = parseInt(input) - 1;
  if (isNaN(idx) || !services || idx < 0 || idx >= services.length) {
    const msg = `❌ أرسل رقم من 1 إلى ${services?.length || 0}\nأرسل 0 للعودة`;
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    return true;
  }

  const service = services[idx];
  const { data: station } = await supabase.from("stations").select("*").eq("id", stationId).single();

  // Instant booking
  if (station.scheduling_type === "instant") {
    return await createBookingAndNotifyOwner(supabase, phone, convId, settings, stationId, service.id, new Date().toISOString().split("T")[0], null);
  }

  // Daily
  if (station.scheduling_type === "daily") {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      const label = i === 0 ? "اليوم" : i === 1 ? "غداً" : d.toLocaleDateString("ar-IQ", { calendar: "gregory", weekday: "long", month: "short", day: "numeric" });
      days.push(label);
    }
    let msg = `✅ اخترت: ${service.name} - ${service.price} د.ع\n\nاختر اليوم:\n`;
    days.forEach((d, i) => { msg += `${i + 1}. ${d}\n`; });
    msg += "\nأرسل 0 للعودة";
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    await updateSession(supabase, phone, { current_step: "awaiting_day", selected_service_id: service.id });
    return true;
  }

  // Slots
  const today = new Date().toISOString().split("T")[0];
  const allSlots = generateTimeSlots(station.working_hours_start, station.working_hours_end, station.slot_duration_minutes);
  const { data: booked } = await supabase.from("bookings").select("booking_time")
    .eq("station_id", stationId).eq("booking_date", today).in("status", ["pending", "confirmed"]);
  const bookedSet = new Set((booked || []).map((b: any) => b.booking_time?.substring(0, 5)));
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const available = allSlots.filter(s => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m > nowMin && !bookedSet.has(s);
  });

  if (available.length === 0) {
    const msg = `عذراً، لا توجد مواعيد متاحة اليوم في ${station.name}.\nأرسل 0 للعودة`;
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    return true;
  }

  let msg = `✅ اخترت: ${service.name} - ${service.price} د.ع\n\nالمواعيد المتاحة اليوم:\n`;
  available.forEach((s, i) => { msg += `${i + 1}. ${s}\n`; });
  msg += "\nأرسل رقم الموعد\nأرسل 0 للعودة";
  const waId = await sendWhatsAppMessage(phone, msg, settings);
  await saveBotMessage(supabase, convId, msg, waId);
  await updateSession(supabase, phone, { current_step: "awaiting_time", selected_service_id: service.id, selected_date: today });
  return true;
}

async function handleDaySelection(supabase: any, phone: string, convId: string, settings: Record<string, string>, session: any, input: string) {
  const days = [];
  for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() + i); days.push(d.toISOString().split("T")[0]); }

  const idx = parseInt(input) - 1;
  if (isNaN(idx) || idx < 0 || idx >= days.length) {
    const msg = `❌ أرسل رقم من 1 إلى ${days.length}\nأرسل 0 للعودة`;
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    return true;
  }

  return await createBookingAndNotifyOwner(supabase, phone, convId, settings, session.selected_station_id, session.selected_service_id, days[idx], null);
}

async function handleTimeSelection(supabase: any, phone: string, convId: string, settings: Record<string, string>, session: any, input: string) {
  const stationId = session.selected_station_id;
  const { data: station } = await supabase.from("stations").select("*").eq("id", stationId).single();
  const bookingDate = session.selected_date;
  const allSlots = generateTimeSlots(station.working_hours_start, station.working_hours_end, station.slot_duration_minutes);
  const { data: booked } = await supabase.from("bookings").select("booking_time")
    .eq("station_id", stationId).eq("booking_date", bookingDate).in("status", ["pending", "confirmed"]);
  const bookedSet = new Set((booked || []).map((b: any) => b.booking_time?.substring(0, 5)));
  const isToday = bookingDate === new Date().toISOString().split("T")[0];
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const available = allSlots.filter(s => {
    const [h, m] = s.split(":").map(Number);
    if (isToday && h * 60 + m <= nowMin) return false;
    return !bookedSet.has(s);
  });

  const idx = parseInt(input) - 1;
  if (isNaN(idx) || idx < 0 || idx >= available.length) {
    const msg = `❌ أرسل رقم من 1 إلى ${available.length}\nأرسل 0 للعودة`;
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    return true;
  }

  return await createBookingAndNotifyOwner(supabase, phone, convId, settings, stationId, session.selected_service_id, bookingDate, available[idx]);
}

// ==================== CREATE BOOKING & NOTIFY OWNER ====================

async function createBookingAndNotifyOwner(
  supabase: any, phone: string, convId: string, settings: Record<string, string>,
  stationId: string, serviceId: string, bookingDate: string, bookingTime: string | null
) {
  const customerName = await getCustomerName(supabase, convId);
  const { data: station } = await supabase.from("stations").select("name").eq("id", stationId).single();
  const { data: service } = await supabase.from("services").select("name, price").eq("id", serviceId).single();

  const insertData: any = {
    customer_phone: phone, customer_name: customerName,
    station_id: stationId, service_id: serviceId,
    booking_date: bookingDate, status: "pending",
  };
  if (bookingTime) insertData.booking_time = bookingTime;

  const { data: booking } = await supabase.from("bookings").insert(insertData).select("id, booking_number").single();

  // Tell customer to wait
  const dateLabel = new Date(bookingDate).toLocaleDateString("ar-IQ", { calendar: "gregory", weekday: "long", year: "numeric", month: "long", day: "numeric" });
  let custMsg = `⏳ جاري تأكيد حجزك مع إدارة المغسلة...\n\n🏪 ${station?.name}\n🧽 ${service?.name} - ${service?.price} د.ع\n📅 ${dateLabel}`;
  if (bookingTime) custMsg += `\n⏰ ${bookingTime}`;
  custMsg += `\n🔢 رقم الحجز: #${booking?.booking_number || "---"}\n\nسنعلمك بالتفاصيل ورقم الحجز خلال لحظات... ⏳`;

  const waId = await sendWhatsAppMessage(phone, custMsg, settings);
  await saveBotMessage(supabase, convId, custMsg, waId);
  await updateSession(supabase, phone, { current_step: "awaiting_owner_response", selected_station_id: null, selected_service_id: null, selected_date: null });

  // Notify station owner via WhatsApp
  if (booking) {
    const { data: owner } = await supabase.from("station_owners")
      .select("owner_phone, owner_name").eq("station_id", stationId).maybeSingle();

    if (owner?.owner_phone) {
      const ownerConvId = await getOrCreateConvForPhone(supabase, owner.owner_phone, owner.owner_name);

      const ownerMsg = `📢 طلب حجز جديد!\n\n🔢 رقم الحجز: #${booking.booking_number}\n📱 العميل: ${customerName || phone}\n🧽 الخدمة: ${service?.name} - ${service?.price} د.ع\n📅 التاريخ: ${dateLabel}${bookingTime ? "\n⏰ الوقت: " + bookingTime : ""}\n\nهل توافق على الحجز؟\nأرسل "موافق" أو "رفض"`;

      const ownerWaId = await sendWhatsAppMessage(owner.owner_phone, ownerMsg, settings);
      if (ownerConvId) {
        await saveBotMessage(supabase, ownerConvId, ownerMsg, ownerWaId);
        // Set owner session to approve/reject
        await getOrCreateSession(supabase, owner.owner_phone);
        await updateSession(supabase, owner.owner_phone, {
          current_step: "owner_approve_reject", pending_booking_id: booking.id, selected_station_id: stationId,
        });
      }
    }
  }

  return true;
}

// ==================== CANCEL / BOOKINGS ====================

async function showMyBookings(supabase: any, phone: string, convId: string, settings: Record<string, string>) {
  const { data: bookings } = await supabase.from("bookings")
    .select("booking_number, booking_date, booking_time, status, stations(name), services(name, price)")
    .eq("customer_phone", phone).in("status", ["pending", "confirmed"]).order("booking_date").limit(10);

  if (!bookings || bookings.length === 0) {
    const msg = "لا توجد لديك حجوزات نشطة حالياً.\nأرسل أي رسالة لحجز جديد.";
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    return true;
  }

  let msg = "📋 حجوزاتك النشطة:\n\n";
  bookings.forEach((b: any) => {
    const label = b.status === "confirmed" ? "مؤكد ✅" : "قيد الانتظار ⏳";
    msg += `🔢 #${b.booking_number} - ${label}\n   🏪 ${b.stations?.name}\n   🧽 ${b.services?.name} - ${b.services?.price} د.ع\n   📅 ${b.booking_date}${b.booking_time ? " ⏰ " + b.booking_time.substring(0, 5) : ""}\n\n`;
  });
  msg += `لإلغاء حجز أرسل: إلغاء #رقم_الحجز`;

  const waId = await sendWhatsAppMessage(phone, msg, settings);
  await saveBotMessage(supabase, convId, msg, waId);
  return true;
}

async function handleCancelBooking(supabase: any, phone: string, convId: string, settings: Record<string, string>, bookingNum: number) {
  const { data: booking } = await supabase.from("bookings")
    .select("id, booking_number, status, stations(name)").eq("booking_number", bookingNum).eq("customer_phone", phone).maybeSingle();

  if (!booking) {
    const msg = `❌ لم يتم العثور على حجز #${bookingNum}.\nأرسل "حجوزاتي" لعرض حجوزاتك.`;
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    return true;
  }

  if (booking.status === "cancelled" || booking.status === "completed") {
    const msg = `⚠️ الحجز #${bookingNum} ${booking.status === "cancelled" ? "ملغي مسبقاً" : "مكتمل"}.`;
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
    return true;
  }

  await updateSession(supabase, phone, { current_step: "confirm_cancel", selected_date: String(bookingNum) });
  const msg = `⚠️ هل تريد إلغاء الحجز #${bookingNum} في ${booking.stations?.name}?\n\nأرسل "نعم" للتأكيد\nأرسل "لا" للتراجع`;
  const waId = await sendWhatsAppMessage(phone, msg, settings);
  await saveBotMessage(supabase, convId, msg, waId);
  return true;
}

async function handleConfirmCancel(supabase: any, phone: string, convId: string, settings: Record<string, string>, session: any, input: string) {
  const bookingNum = parseInt(session.selected_date);
  if (input === "نعم" || input === "اي" || input === "أي") {
    await supabase.from("bookings").update({ status: "cancelled" }).eq("booking_number", bookingNum).eq("customer_phone", phone);
    const msg = `✅ تم إلغاء الحجز #${bookingNum}.\nأرسل أي رسالة لحجز جديد.`;
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
  } else {
    const msg = "تم التراجع عن الإلغاء. ✅";
    const waId = await sendWhatsAppMessage(phone, msg, settings);
    await saveBotMessage(supabase, convId, msg, waId);
  }
  await updateSession(supabase, phone, { current_step: "idle", selected_station_id: null, selected_service_id: null, selected_date: null });
  return true;
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
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
      const sig = req.headers.get("x-hub-signature-256") || "";
      if (!(await verifySignature(bodyText, sig, settings.WHATSAPP_APP_SECRET))) {
        console.error("Invalid signature");
        return new Response(JSON.stringify({ success: false }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    let body: any;
    try { body = JSON.parse(bodyText); } catch { return new Response(JSON.stringify({ success: false }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

    try {
      for (const entry of (body.entry || [])) {
        for (const change of (entry.changes || [])) {
          const value = change.value;

          // Status updates
          if (value.statuses) {
            for (const status of value.statuses) {
              await supabase.from("messages").update({ status: status.status }).eq("whatsapp_message_id", status.id);
            }
          }

          // Incoming messages
          if (value.messages) {
            for (const msg of value.messages) {
              const phone = msg.from;
              const contactName = value.contacts?.[0]?.profile?.name || phone;
              const messageType = msg.type || "text";

              let content = "";
              let mediaId: string | null = null;
              let mediaMime: string | undefined;
              let locationData: { latitude: number; longitude: number } | undefined;

              switch (msg.type) {
                case "text": content = msg.text?.body || ""; break;
                case "image": content = msg.image?.caption || "📷 صورة"; mediaId = msg.image?.id; mediaMime = msg.image?.mime_type; break;
                case "audio": content = "🎵 رسالة صوتية"; mediaId = msg.audio?.id; mediaMime = msg.audio?.mime_type; break;
                case "video": content = msg.video?.caption || "🎥 فيديو"; mediaId = msg.video?.id; mediaMime = msg.video?.mime_type; break;
                case "document": content = msg.document?.filename || "📄 مستند"; mediaId = msg.document?.id; mediaMime = msg.document?.mime_type; break;
                case "sticker": content = "😊 ملصق"; mediaId = msg.sticker?.id; mediaMime = msg.sticker?.mime_type; break;
                case "location":
                  content = `📍 موقع: ${msg.location?.latitude}, ${msg.location?.longitude}`;
                  locationData = { latitude: msg.location?.latitude, longitude: msg.location?.longitude };
                  break;
                case "interactive":
                  content = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "";
                  break;
                default: content = msg.type || "";
              }

              // Duplicate check
              if (msg.id) {
                const { data: dup } = await supabase.from("messages").select("id").eq("whatsapp_message_id", msg.id).maybeSingle();
                if (dup) continue;
              }

              // Download media
              let mediaUrl: string | null = null;
              if (mediaId && settings.WHATSAPP_ACCESS_TOKEN) {
                mediaUrl = await downloadAndStoreMedia(mediaId, settings.WHATSAPP_ACCESS_TOKEN, supabase, messageType, mediaMime);
              }

              // Find or create conversation
              const now = new Date().toISOString();
              let convId: string;
              const { data: existingConv } = await supabase.from("conversations").select("id").eq("customer_phone", phone).eq("status", "open").maybeSingle();

              if (existingConv) {
                convId = existingConv.id;
                await supabase.from("conversations").update({ last_message_at: now, customer_name: contactName }).eq("id", convId);
              } else {
                const { data: newConv } = await supabase.from("conversations")
                  .insert({ customer_phone: phone, customer_name: contactName, status: "open", last_message_at: now, platform: "whatsapp" })
                  .select("id").single();
                if (!newConv) continue;
                convId = newConv.id;
              }

              // Save inbound message
              await supabase.from("messages").insert({
                conversation_id: convId, direction: "inbound", content,
                message_type: messageType, whatsapp_message_id: msg.id,
                status: "delivered", media_url: mediaUrl, platform: "whatsapp",
              });

              // === ROUTING: Owner or Customer? ===
              const owner = await checkIfOwner(supabase, phone);

              if (owner) {
                // Owner flow
                const buttonId = msg.interactive?.button_reply?.id;
                const actualInput = buttonId || content;
                await handleOwnerLogic(supabase, phone, actualInput, convId, settings, owner);
              } else if (messageType === "text" || messageType === "location" || messageType === "interactive") {
                // Customer flow
                const buttonId = msg.interactive?.button_reply?.id;
                const actualInput = buttonId || content;
                await handleCustomerLogic(supabase, phone, actualInput, convId, settings, locationData);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Webhook error:", error);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response("Method not allowed", { status: 405 });
});
