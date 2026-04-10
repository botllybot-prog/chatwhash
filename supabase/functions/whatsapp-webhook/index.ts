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

function downloadAndStoreMedia(mediaId: string, accessToken: string, supabase: any, messageType: string, mimeType?: string): Promise<string | null> {
  return fetch(`https://graph.facebook.com/v21.0/${mediaId}`, { headers: { Authorization: `Bearer ${accessToken}` } })
    .then(res => res.ok ? res.json() : null)
    .then(info => {
      if (!info) return null;
      const mime = mimeType || info.mime_type || "application/octet-stream";
      return fetch(info.url, { headers: { Authorization: `Bearer ${accessToken}` } })
        .then(fileRes => fileRes.ok ? fileRes.blob() : null)
        .then(blob => {
          if (!blob) return null;
          const path = `${messageType}/${mediaId}.${getExtension(mime)}`;
          return supabase.storage.from("whatsapp-media").upload(path, blob, { contentType: mime, upsert: true })
            .then(() => supabase.storage.from("whatsapp-media").getPublicUrl(path).data?.publicUrl || null);
        });
    })
    .catch(() => null);
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

// Fire-and-forget: send message + save to DB in parallel (don't block on DB save)
async function sendAndSave(supabase: any, convId: string, phone: string, message: string, settings: Record<string, string>) {
  const waId = await sendWhatsAppMessage(phone, message, settings);
  // Save to DB without blocking the caller
  saveBotMessage(supabase, convId, message, waId);
  return waId;
}

function saveBotMessage(supabase: any, convId: string, content: string, waMessageId: string | null) {
  const now = new Date().toISOString();
  // Run both DB operations in parallel, don't await
  Promise.all([
    supabase.from("messages").insert({
      conversation_id: convId, direction: "outbound", content, message_type: "text",
      whatsapp_message_id: waMessageId, status: "sent", platform: "whatsapp",
    }),
    supabase.from("conversations").update({ last_message_at: now }).eq("id", convId),
  ]).catch(e => console.error("saveBotMessage error:", e));
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
    // Don't await the update - return immediately with merged data
    supabase.from("bot_sessions").update(sessionData).eq("id", data.id).then(() => {}).catch(() => {});
    return { ...data, ...sessionData };
  }
  const { data: ns } = await supabase.from("bot_sessions").insert(sessionData).select().single();
  return ns;
}

function updateSession(supabase: any, phone: string, updates: Record<string, any>) {
  // Fire-and-forget: don't block on session updates
  supabase.from("bot_sessions").update({
    ...updates, expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), updated_at: new Date().toISOString(),
  }).eq("customer_phone", phone).then(() => {}).catch((e: any) => console.error("updateSession error:", e));
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

function estimateMinutes(distKm: number): number {
  return Math.max(1, Math.round(distKm / 40 * 60));
}

function replaceTemplateVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

const STATIONS_PER_PAGE = 5;

async function sendWhatsAppList(phone: string, body: string, buttonText: string, sections: { title: string; rows: { id: string; title: string; description?: string }[] }[], settings: Record<string, string>) {
  const token = settings.WHATSAPP_ACCESS_TOKEN;
  const phoneId = settings.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return null;
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: phone, type: "interactive",
        interactive: { type: "list", body: { text: body }, action: { button: buttonText, sections } },
      }),
    });
    const data = await res.json();
    return data.messages?.[0]?.id || null;
  } catch { return null; }
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

// ==================== BOT CUSTOMER AUTO-REGISTER ====================

function upsertBotCustomer(supabase: any, phone: string, name: string | null, platform: string) {
  const now = new Date().toISOString();
  supabase.from("bot_customers").select("id").eq("phone", phone).eq("platform", platform).maybeSingle()
    .then(({ data }: any) => {
      if (data) {
        supabase.from("bot_customers").update({ name: name || undefined, last_seen_at: now }).eq("id", data.id).then(() => {}).catch(() => {});
      } else {
        supabase.from("bot_customers").insert({ phone, name, platform, first_seen_at: now, last_seen_at: now }).then(() => {}).catch(() => {});
      }
    }).catch((e: any) => console.error("upsertBotCustomer error:", e));
}

function incrementCustomerBookings(supabase: any, phone: string, platform: string) {
  const now = new Date().toISOString();
  supabase.from("bot_customers").select("id, total_bookings").eq("phone", phone).eq("platform", platform).maybeSingle()
    .then(({ data }: any) => {
      if (data) {
        supabase.from("bot_customers").update({ total_bookings: (data.total_bookings || 0) + 1, last_booking_at: now }).eq("id", data.id).then(() => {}).catch(() => {});
      }
    }).catch(() => {});
}

// ==================== ADMIN NOTIFICATION ====================

function notifyAdmin(supabase: any, settings: Record<string, string>, message: string) {
  const adminPhone = settings.ADMIN_WHATSAPP_PHONE;
  if (!adminPhone) return;
  // Fire-and-forget: send admin a copy
  (async () => {
    try {
      const convId = await getOrCreateConvForPhone(supabase, adminPhone, "المسؤول");
      await sendWhatsAppMessage(adminPhone, message, settings);
      if (convId) saveBotMessage(supabase, convId, message, null);
    } catch (e) { console.error("Admin notify error:", e); }
  })();
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
    updateSession(supabase, phone, { current_step: "owner_idle", selected_station_id: null, pending_booking_id: null });
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
      updateSession(supabase, phone, { current_step: "owner_idle" });
      return await showOwnerMenu(supabase, phone, convId, settings, owner);
    }

    if (input === "approve_reschedule") {
      const [, bkResult] = await Promise.all([
        supabase.from("bookings").update({ status: "cancelled" }).eq("id", bookingId),
        supabase.from("bookings").select("customer_phone, booking_number").eq("id", bookingId).single(),
      ]);
      const bk = bkResult.data;
      const rescheduleMsg = "✅ تم إبلاغ صاحب المغسلة لتعديل الموعد.\n\nأرسل أي رسالة لعرض القائمة.";
      const promises: Promise<any>[] = [sendAndSave(supabase, convId, phone, rescheduleMsg, settings)];
      if (bk) {
        const custConvId = await getOrCreateConvForPhone(supabase, bk.customer_phone);
        if (custConvId) {
          const custMsg = `⚠️ عذراً، طلب صاحب المغسلة تعديل موعد حجزك #${bk.booking_number}.\n\nالرجاء إعادة الحجز باختيار موعد آخر. أرسل أي رسالة للبدء.`;
          promises.push(sendAndSave(supabase, custConvId, bk.customer_phone, custMsg, settings));
        }
      }
      await Promise.all(promises);
      updateSession(supabase, phone, { current_step: "owner_idle", pending_booking_id: null });
      return true;
    }

    if (input === "موافق" || input === "approve_yes") {
      updateSession(supabase, phone, { current_step: "owner_offer" });
      const msg = "✅ تمت الموافقة!\n\nهل يوجد عرض خاص ترغب بإرفاقه للعميل اليوم؟\n(اكتب العرض أو أرسل \"لا\" للتخطي)";
      await sendAndSave(supabase, convId, phone, msg, settings);
      return true;
    }

    if (input === "رفض" || input === "approve_no") {
      const [, bookingResult] = await Promise.all([
        supabase.from("bookings").update({ status: "cancelled" }).eq("id", bookingId),
        supabase.from("bookings").select("customer_phone, booking_number, stations(name)").eq("id", bookingId).single(),
      ]);
      const booking = bookingResult.data;

      // Notify customer and owner in parallel
      const ownerMsg = "✅ تم رفض الحجز وإبلاغ العميل.\n\nأرسل أي رسالة لعرض القائمة.";
      const promises: Promise<any>[] = [sendAndSave(supabase, convId, phone, ownerMsg, settings)];

      if (booking) {
        const custConvId = await getOrCreateConvForPhone(supabase, booking.customer_phone);
        if (custConvId) {
          const custMsg = `❌ عذراً، تم رفض حجزك #${booking.booking_number} في ${booking.stations?.name}.\n\nيمكنك حجز موعد آخر بإرسال أي رسالة.`;
          promises.push(sendAndSave(supabase, custConvId, booking.customer_phone, custMsg, settings));
        }
      }

      await Promise.all(promises);
      updateSession(supabase, phone, { current_step: "owner_idle", pending_booking_id: null });
      return true;
    }

    const fallbackMsg = "يرجى اختيار أحد الخيارات:";
    const fbWaId = await sendWhatsAppInteractive(phone, fallbackMsg, [
      { id: "approve_yes", title: "✅ موافق" },
      { id: "approve_no", title: "❌ غير موافق" },
      { id: "approve_reschedule", title: "📅 تعديل الموعد" },
    ], settings);
    saveBotMessage(supabase, convId, fallbackMsg, fbWaId);
    return true;
  }

  // Owner adding offer
  if (step === "owner_offer") {
    const bookingId = session.pending_booking_id;
    const offer = (input === "لا" || input === "no") ? null : input;
    if (offer) supabase.from("bookings").update({ owner_offer: offer }).eq("id", bookingId).then(() => {}).catch(() => {});

    updateSession(supabase, phone, { current_step: "owner_note" });
    const msg = "هل توجد ملاحظة إضافية للعميل؟\n(اكتب الملاحظة أو أرسل \"لا\" للتخطي)";
    await sendAndSave(supabase, convId, phone, msg, settings);
    return true;
  }

  // Owner adding note
  if (step === "owner_note") {
    const bookingId = session.pending_booking_id;
    const note = (input === "لا" || input === "no") ? null : input;

    // Update note + confirm booking in parallel
    const updates: Promise<any>[] = [
      supabase.from("bookings").update({ status: "confirmed", ...(note ? { owner_note: note } : {}) }).eq("id", bookingId),
    ];
    if (note) updates.push(supabase.from("bookings").update({ owner_note: note }).eq("id", bookingId));

    const [, bookingResult] = await Promise.all([
      Promise.all(updates),
      supabase.from("bookings")
        .select("booking_number, customer_phone, booking_date, booking_time, owner_offer, owner_note, stations(name), services(name, price)")
        .eq("id", bookingId).single(),
    ]);
    const booking = bookingResult.data;

    // Confirm to owner immediately
    const ownerMsg = "✅ تم تأكيد الحجز وإرسال التفاصيل للعميل.\n\nأرسل أي رسالة لعرض القائمة.";
    const ownerSend = sendAndSave(supabase, convId, phone, ownerMsg, settings);

    // Send final confirmation to customer in parallel
    if (booking) {
      const custConvId = await getOrCreateConvForPhone(supabase, booking.customer_phone);
      if (custConvId) {
        const templateVars = {
          booking_number: String(booking.booking_number), station: booking.stations?.name || "",
          service: booking.services?.name || "", price: String(booking.services?.price || ""),
          date: booking.booking_date, time: booking.booking_time ? booking.booking_time.substring(0, 5) : "",
          offer: booking.owner_offer || "", note: note || booking.owner_note || "",
        };
        let custMsg = replaceTemplateVars(
          settings.BOT_THANK_YOU_MESSAGE || "✅ تم تأكيد حجزك بنجاح!\n\n🔢 #{booking_number}\n🏪 {station}\n🧽 {service} - {price} د.ع\n📅 {date}",
          templateVars
        );
        if (booking.booking_time) custMsg += `\n⏰ الوقت: ${booking.booking_time.substring(0, 5)}`;
        if (booking.owner_offer) custMsg += `\n\n🎁 عرض خاص لك اليوم: ${booking.owner_offer}`;
        if (note) custMsg += `\n📝 ملاحظة من الإدارة: ${note}`;
        else if (booking.owner_note) custMsg += `\n📝 ملاحظة من الإدارة: ${booking.owner_note}`;
        custMsg += "\n\nنتمنى لك تجربة رائعة! 🚗✨";
        sendAndSave(supabase, custConvId, booking.customer_phone, custMsg, settings);
      }
    }

    await ownerSend;
    updateSession(supabase, phone, { current_step: "owner_idle", pending_booking_id: null });
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
      await sendAndSave(supabase, convId, phone, msg, settings);
      return true;
    }

    const b = pendingBookings[idx];
    updateSession(supabase, phone, { current_step: "owner_approve_reject", pending_booking_id: b.id });

    const detailMsg = `📋 تفاصيل الحجز #${b.booking_number}:\n\n📱 العميل: ${b.customer_name || b.customer_phone}\n🧽 الخدمة: ${b.services?.name} - ${b.services?.price} د.ع\n📅 التاريخ: ${b.booking_date}${b.booking_time ? "\n⏰ الوقت: " + b.booking_time.substring(0, 5) : ""}\n\nهل توافق على الحجز؟`;
    const waId = await sendWhatsAppInteractive(phone, detailMsg, [
      { id: "approve_yes", title: "✅ موافق" },
      { id: "approve_no", title: "❌ غير موافق" },
      { id: "approve_reschedule", title: "📅 تعديل الموعد" },
    ], settings);
    saveBotMessage(supabase, convId, detailMsg, waId);
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

  await sendAndSave(supabase, convId, phone, msg, settings);
  updateSession(supabase, phone, {
    current_step: pendingBookings && pendingBookings.length > 0 ? "owner_view_pending" : "owner_idle",
    selected_station_id: owner.station_id,
  });
  return true;
}

// ==================== CUSTOMER BOT LOGIC ====================

async function handleCustomerLogic(
  supabase: any, phone: string, content: string, convId: string, settings: Record<string, string>,
  locationData?: { latitude: number; longitude: number }, contactName?: string
): Promise<boolean> {
  if (settings.BOT_ENABLED !== "true") return false;

  const session = await getOrCreateSession(supabase, phone);
  if (!session) return false;

  const input = content.trim();

  // "0" resets
  if (input === "0") {
    updateSession(supabase, phone, { current_step: "idle", selected_station_id: null, selected_service_id: null, selected_date: null, pending_booking_id: null });
    return await showCustomerWelcome(supabase, phone, convId, settings, contactName);
  }

  // Button callbacks
  if (input === "btn_location") {
    // Send location request message - shows native location picker button
    const token = settings.WHATSAPP_ACCESS_TOKEN;
    const phoneId = settings.WHATSAPP_PHONE_NUMBER_ID;
    if (token && phoneId) {
      try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp", to: phone, type: "interactive",
            interactive: {
              type: "location_request_message",
              body: { text: "📍 اضغط الزر أدناه لمشاركة موقعك الحالي وسنعرض لك أقرب المغاسل إليك." },
              action: { name: "send_location" },
            },
          }),
        });
        const data = await res.json();
        saveBotMessage(supabase, convId, "📍 طلب مشاركة الموقع", data.messages?.[0]?.id || null);
      } catch {}
    }
    updateSession(supabase, phone, { current_step: "awaiting_station" });
    return true;
  }
  if (input === "btn_search") {
    await sendAndSave(supabase, convId, phone, "🔍 اكتب اسم المغسلة للبحث:", settings);
    updateSession(supabase, phone, { current_step: "awaiting_station" });
    return true;
  }
  if (input === "btn_bookings") {
    return await showMyBookings(supabase, phone, convId, settings);
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
    await sendAndSave(supabase, convId, phone, msg, settings);
    return true;
  }

  // Idle - welcome with location request
  if (step === "idle") {
    return await showCustomerWelcome(supabase, phone, convId, settings, contactName);
  }

  // Awaiting station selection
  if (step === "awaiting_station") return await handleStationSelection(supabase, phone, convId, settings, session, input);

  // Awaiting service
  if (step === "awaiting_service") return await handleServiceSelection(supabase, phone, convId, settings, session, input);

  // Awaiting day
  if (step === "awaiting_day") return await handleDaySelection(supabase, phone, convId, settings, session, input);

  // Awaiting time
  if (step === "awaiting_time") return await handleTimeSelection(supabase, phone, convId, settings, session, input);

  // Unknown step - send DB unknown message
  const unknownMsg = settings.BOT_UNKNOWN_MESSAGE || "عذراً، لم أفهم رسالتك.";
  await sendAndSave(supabase, convId, phone, unknownMsg + "\nأرسل 0 للعودة", settings);
  updateSession(supabase, phone, { current_step: "idle" });
  return true;
}

async function showCustomerWelcome(supabase: any, phone: string, convId: string, settings: Record<string, string>, contactName?: string) {
  // Get customer name from conversation or contact
  let name = contactName;
  if (!name) {
    const { data: conv } = await supabase.from("conversations").select("customer_name").eq("customer_phone", phone).eq("status", "open").maybeSingle();
    name = conv?.customer_name;
  }
  const firstName = name ? name.split(" ")[0] : "";

  const welcomeTemplate = settings.BOT_WELCOME_MESSAGE || "مرحباً بك في خدمة غسيل السيارات!";
  const greeting = firstName
    ? `أهلاً وسهلاً *${firstName}* 👋\n${welcomeTemplate} 🚗✨`
    : `أهلاً وسهلاً 👋\n${welcomeTemplate} 🚗✨`;

  const body = `${greeting}\n\n━━━━━━━━━━━━━━━\nكيف يمكنني مساعدتك اليوم؟`;
  const buttons = [
    { id: "btn_location", title: "📍 شارك موقعك" },
    { id: "btn_search", title: "🔍 ابحث عن مغسلة" },
    { id: "btn_bookings", title: "📋 حجوزاتي" },
  ];

  const waId = await sendWhatsAppInteractive(phone, body, buttons, settings);
  saveBotMessage(supabase, convId, body, waId);
  updateSession(supabase, phone, { current_step: "awaiting_station" });
  return true;
}

async function showStationsPage(supabase: any, phone: string, convId: string, settings: Record<string, string>, page: number) {
  const offset = page * STATIONS_PER_PAGE;
  const [listResult, countResult] = await Promise.all([
    supabase.from("stations").select("id, name, address").eq("is_active", true).order("created_at").range(offset, offset + STATIONS_PER_PAGE - 1),
    supabase.from("stations").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);
  const stations = listResult.data || [];
  const total = countResult.count || 0;
  const totalPages = Math.ceil(total / STATIONS_PER_PAGE);

  if (stations.length === 0) {
    await sendAndSave(supabase, convId, phone, "لا توجد مغاسل متاحة حالياً.\nأرسل 0 للعودة.", settings);
    return true;
  }

  const rows = stations.map((s: any) => ({
    id: `sid_${s.id}`,
    title: s.name.substring(0, 24),
    description: s.address ? s.address.substring(0, 72) : undefined,
  }));

  // Add nav rows
  if (page > 0) rows.push({ id: `page_${page - 1}`, title: "◀️ الصفحة السابقة" });
  if (page < totalPages - 1) rows.push({ id: `page_${page + 1}`, title: "▶️ الصفحة التالية" });

  const body = `🏪 المغاسل المتاحة (${page + 1}/${totalPages}) — ${total} مغسلة`;
  const waId = await sendWhatsAppList(phone, body, "اختر مغسلة", [{ title: "المغاسل", rows }], settings);
  saveBotMessage(supabase, convId, body, waId);
  return true;
}

async function searchStations(supabase: any, phone: string, convId: string, settings: Record<string, string>, query: string) {
  const { data: stations } = await supabase.from("stations").select("id, name, address")
    .eq("is_active", true).or(`name.ilike.%${query}%,address.ilike.%${query}%`).order("created_at").limit(10);

  if (!stations || stations.length === 0) {
    await sendAndSave(supabase, convId, phone, `❌ لم يتم العثور على مغاسل بـ \"${query}\".\nأرسل \"قائمة\" لعرض المغاسل أو 0 للعودة.`, settings);
    return true;
  }

  const rows = stations.map((s: any) => ({
    id: `sid_${s.id}`,
    title: s.name.substring(0, 24),
    description: s.address ? s.address.substring(0, 72) : undefined,
  }));

  const body = `🔍 نتائج البحث عن \"${query}\" (${stations.length})`;
  const waId = await sendWhatsAppList(phone, body, "اختر مغسلة", [{ title: "النتائج", rows }], settings);
  saveBotMessage(supabase, convId, body, waId);
  return true;
}

async function handleLocationMessage(supabase: any, phone: string, convId: string, settings: Record<string, string>, loc: { latitude: number; longitude: number }) {
  const { data: stations } = await supabase.from("stations")
    .select("id, name, address, latitude, longitude").eq("is_active", true);

  if (!stations || stations.length === 0) {
    await sendAndSave(supabase, convId, phone, "عذراً، لا توجد مغاسل متاحة حالياً.", settings);
    return true;
  }

  const MAX_RADIUS_KM = 30;
  const withDist = stations
    .filter((s: any) => s.latitude && s.longitude)
    .map((s: any) => ({ ...s, distance: haversineDistance(loc.latitude, loc.longitude, s.latitude, s.longitude) }))
    .filter((s: any) => s.distance <= MAX_RADIUS_KM)
    .sort((a: any, b: any) => a.distance - b.distance);

  if (withDist.length === 0) {
    await sendAndSave(supabase, convId, phone, `📍 لا توجد مغاسل ضمن ${MAX_RADIUS_KM} كم من موقعك.\nأرسل \"قائمة\" لعرض جميع المغاسل أو 0 للعودة.`, settings);
    return true;
  }

  // Use WhatsApp list message for nearby stations (up to 10)
  const nearby = withDist.slice(0, 10);
  const rows = nearby.map((s: any) => ({
    id: `sid_${s.id}`,
    title: s.name.substring(0, 24),
    description: `📏 ${s.distance.toFixed(1)} كم ≈ ${estimateMinutes(s.distance)} دقيقة`.substring(0, 72),
  }));

  const body = `📍 المغاسل القريبة (${nearby.length}) ضمن ${MAX_RADIUS_KM} كم:\n\n` +
    nearby.map((s: any) => `🏪 ${s.name}\n   📏 ${s.distance.toFixed(1)} كم ≈ ${estimateMinutes(s.distance)} دقيقة`).join("\n");

  const waId = await sendWhatsAppList(phone, body, "اختر مغسلة", [{ title: "المغاسل القريبة", rows }], settings);
  saveBotMessage(supabase, convId, body, waId);
  updateSession(supabase, phone, { current_step: "awaiting_station" });
  return true;
}

async function handleStationSelection(supabase: any, phone: string, convId: string, settings: Record<string, string>, session: any, input: string) {
  // Handle pagination: page_N
  const pageMatch = input.match(/^page_(\d+)$/);
  if (pageMatch) return await showStationsPage(supabase, phone, convId, settings, parseInt(pageMatch[1]));

  // Handle station ID from list reply: sid_UUID
  const sidMatch = input.match(/^sid_([a-f0-9-]+)$/i);
  if (sidMatch) {
    const { data: station } = await supabase.from("stations").select("id, name").eq("id", sidMatch[1]).eq("is_active", true).maybeSingle();
    if (station) return await showServicesForStation(supabase, phone, convId, settings, station.id, station.name);
    await sendAndSave(supabase, convId, phone, "❌ المغسلة غير متاحة.\nأرسل \"قائمة\" لعرض المغاسل.", settings);
    return true;
  }

  // Handle "قائمة" - show paginated list
  if (input === "قائمة" || input === "القائمة" || input === "list") {
    return await showStationsPage(supabase, phone, convId, settings, 0);
  }

  // Handle text search - any other text
  const unknownMsg = settings.BOT_UNKNOWN_MESSAGE || "عذراً، لم أفهم رسالتك. أرسل \"قائمة\" لعرض المغاسل أو شارك موقعك.";
  if (input.length >= 2 && !/^\d+$/.test(input)) {
    return await searchStations(supabase, phone, convId, settings, input);
  }

  await sendAndSave(supabase, convId, phone, unknownMsg, settings);
  return true;
}

async function showServicesForStation(supabase: any, phone: string, convId: string, settings: Record<string, string>, stationId: string, stationName: string) {
  const { data: services } = await supabase.from("services").select("id, name, price")
    .eq("is_active", true).or(`station_id.eq.${stationId},station_id.is.null`).order("sort_order");

  if (!services || services.length === 0) {
    await sendAndSave(supabase, convId, phone, `عذراً، لا توجد خدمات متاحة في ${stationName} حالياً.\nأرسل 0 للعودة`, settings);
    return true;
  }

  let msg = `✅ اخترت: ${stationName}\n\nاختر الخدمة:\n`;
  services.forEach((s: any, i: number) => { msg += `${i + 1}. ${s.name} - ${s.price} د.ع\n`; });
  msg += "\nأرسل رقم الخدمة\nأرسل 0 للعودة";

  await sendAndSave(supabase, convId, phone, msg, settings);
  updateSession(supabase, phone, { current_step: "awaiting_service", selected_station_id: stationId });
  return true;
}

async function handleServiceSelection(supabase: any, phone: string, convId: string, settings: Record<string, string>, session: any, input: string) {
  const stationId = session.selected_station_id;

  // Fetch services and station in parallel
  const [servicesResult, stationResult] = await Promise.all([
    supabase.from("services").select("id, name, price").eq("is_active", true).or(`station_id.eq.${stationId},station_id.is.null`).order("sort_order"),
    supabase.from("stations").select("*").eq("id", stationId).single(),
  ]);
  const services = servicesResult.data;
  const station = stationResult.data;

  const idx = parseInt(input) - 1;
  if (isNaN(idx) || !services || idx < 0 || idx >= services.length) {
    await sendAndSave(supabase, convId, phone, `❌ أرسل رقم من 1 إلى ${services?.length || 0}\nأرسل 0 للعودة`, settings);
    return true;
  }

  const service = services[idx];

  // After-hours check for instant booking
  if (station.scheduling_type === "instant") {
    if (settings.BOT_AFTER_HOURS_ENABLED === "true" && station.working_hours_start && station.working_hours_end) {
      const nowMin = new Date(Date.now() + 3 * 60 * 60 * 1000).getUTCHours() * 60 + new Date(Date.now() + 3 * 60 * 60 * 1000).getUTCMinutes();
      const [sh, sm] = station.working_hours_start.split(":").map(Number);
      const [eh, em] = station.working_hours_end.split(":").map(Number);
      if (nowMin < sh * 60 + sm || nowMin > eh * 60 + em) {
        const afterMsg = replaceTemplateVars(settings.BOT_AFTER_HOURS_MESSAGE || "عذراً، المغسلة مغلقة حالياً. مواعيد العمل: {start} - {end}", { start: station.working_hours_start, end: station.working_hours_end, station: station.name });
        await sendAndSave(supabase, convId, phone, afterMsg + "\nأرسل 0 للعودة", settings);
        return true;
      }
    }
    return await createBookingAndNotifyOwner(supabase, phone, convId, settings, stationId, service.id, new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split("T")[0], null);
  }

  // Daily
  if (station.scheduling_type === "daily") {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.now() + 3 * 60 * 60 * 1000);
      d.setUTCDate(d.getUTCDate() + i);
      const label = i === 0 ? "اليوم" : i === 1 ? "غداً" : d.toLocaleDateString("ar-IQ", { calendar: "gregory", weekday: "long", month: "short", day: "numeric" });
      days.push(label);
    }
    let msg = `✅ اخترت: ${service.name} - ${service.price} د.ع\n\nاختر اليوم:\n`;
    days.forEach((d, i) => { msg += `${i + 1}. ${d}\n`; });
    msg += "\nأرسل 0 للعودة";
    await sendAndSave(supabase, convId, phone, msg, settings);
    updateSession(supabase, phone, { current_step: "awaiting_day", selected_service_id: service.id });
    return true;
  }

  // Slots
  const iraqNow = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const today = iraqNow.toISOString().split("T")[0];
  const allSlots = generateTimeSlots(station.working_hours_start, station.working_hours_end, station.slot_duration_minutes);
  const { data: booked } = await supabase.from("bookings").select("booking_time")
    .eq("station_id", stationId).eq("booking_date", today).in("status", ["pending", "confirmed"]);
  const bookedSet = new Set((booked || []).map((b: any) => b.booking_time?.substring(0, 5)));
  const nowMin = iraqNow.getUTCHours() * 60 + iraqNow.getUTCMinutes();
  const available = allSlots.filter(s => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m > nowMin && !bookedSet.has(s);
  });

  if (available.length === 0) {
    const fullyBookedMsg = replaceTemplateVars(settings.BOT_FULLY_BOOKED_MESSAGE || "عذراً، لا توجد مواعيد متاحة اليوم في {station}.", { station: station.name });
    await sendAndSave(supabase, convId, phone, fullyBookedMsg + "\nأرسل 0 للعودة", settings);
    return true;
  }

  let msg = `✅ اخترت: ${service.name} - ${service.price} د.ع\n\nالمواعيد المتاحة اليوم:\n`;
  available.forEach((s, i) => { msg += `${i + 1}. ${s}\n`; });
  msg += "\nأرسل رقم الموعد\nأرسل 0 للعودة";
  await sendAndSave(supabase, convId, phone, msg, settings);
  updateSession(supabase, phone, { current_step: "awaiting_time", selected_service_id: service.id, selected_date: today });
  return true;
}

async function handleDaySelection(supabase: any, phone: string, convId: string, settings: Record<string, string>, session: any, input: string) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() + 3 * 60 * 60 * 1000);
    d.setUTCDate(d.getUTCDate() + i);
    days.push(d.toISOString().split("T")[0]);
  }

  const idx = parseInt(input) - 1;
  if (isNaN(idx) || idx < 0 || idx >= days.length) {
    await sendAndSave(supabase, convId, phone, `❌ أرسل رقم من 1 إلى ${days.length}\nأرسل 0 للعودة`, settings);
    return true;
  }

  return await createBookingAndNotifyOwner(supabase, phone, convId, settings, session.selected_station_id, session.selected_service_id, days[idx], null);
}

async function handleTimeSelection(supabase: any, phone: string, convId: string, settings: Record<string, string>, session: any, input: string) {
  const stationId = session.selected_station_id;
  const bookingDate = session.selected_date;

  const [stationResult, bookedResult] = await Promise.all([
    supabase.from("stations").select("*").eq("id", stationId).single(),
    supabase.from("bookings").select("booking_time").eq("station_id", stationId).eq("booking_date", bookingDate).in("status", ["pending", "confirmed"]),
  ]);
  const station = stationResult.data;
  const booked = bookedResult.data;

  const allSlots = generateTimeSlots(station.working_hours_start, station.working_hours_end, station.slot_duration_minutes);
  const bookedSet = new Set((booked || []).map((b: any) => b.booking_time?.substring(0, 5)));
  const iraqNow = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const isToday = bookingDate === iraqNow.toISOString().split("T")[0];
  const nowMin = iraqNow.getUTCHours() * 60 + iraqNow.getUTCMinutes();
  const available = allSlots.filter(s => {
    const [h, m] = s.split(":").map(Number);
    if (isToday && h * 60 + m <= nowMin) return false;
    return !bookedSet.has(s);
  });

  const idx = parseInt(input) - 1;
  if (isNaN(idx) || idx < 0 || idx >= available.length) {
    await sendAndSave(supabase, convId, phone, `❌ أرسل رقم من 1 إلى ${available.length}\nأرسل 0 للعودة`, settings);
    return true;
  }

  return await createBookingAndNotifyOwner(supabase, phone, convId, settings, stationId, session.selected_service_id, bookingDate, available[idx]);
}

// ==================== CREATE BOOKING & NOTIFY OWNER ====================

async function createBookingAndNotifyOwner(
  supabase: any, phone: string, convId: string, settings: Record<string, string>,
  stationId: string, serviceId: string, bookingDate: string, bookingTime: string | null
) {
  // Fetch station, service, and customer name in parallel
  const [stationResult, serviceResult, customerName] = await Promise.all([
    supabase.from("stations").select("name").eq("id", stationId).single(),
    supabase.from("services").select("name, price").eq("id", serviceId).single(),
    getCustomerName(supabase, convId),
  ]);
  const station = stationResult.data;
  const service = serviceResult.data;

  const insertData: any = {
    customer_phone: phone, customer_name: customerName,
    station_id: stationId, service_id: serviceId,
    booking_date: bookingDate, status: "pending",
  };
  if (bookingTime) insertData.booking_time = bookingTime;

  const { data: booking } = await supabase.from("bookings").insert(insertData).select("id, booking_number").single();

  // Tell customer - use DB confirmation message
  const dateLabel = new Date(bookingDate).toLocaleDateString("ar-IQ", { calendar: "gregory", weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const templateVars = {
    station: station?.name || "", service: service?.name || "", price: String(service?.price || ""),
    date: dateLabel, time: bookingTime || "", booking_number: String(booking?.booking_number || "---"),
    customer: customerName || phone,
  };
  const confirmTemplate = settings.BOT_CONFIRMATION_MESSAGE || "⏳ جاري تأكيد حجزك...\n\n🏪 {station}\n🧽 {service} - {price} د.ع\n📅 {date}\n🔢 #{booking_number}";
  let custMsg = replaceTemplateVars(confirmTemplate, templateVars);
  if (bookingTime) custMsg += `\n⏰ ${bookingTime}`;
  custMsg += "\n\nسنعلمك بالتفاصيل خلال لحظات... ⏳";

  // Send customer message and update session in parallel
  const custSend = sendAndSave(supabase, convId, phone, custMsg, settings);
  updateSession(supabase, phone, { current_step: "awaiting_owner_response", selected_station_id: null, selected_service_id: null, selected_date: null });

  // Notify station owner (fire-and-forget, don't block customer response)
  if (booking) {
    supabase.from("station_owners")
      .select("owner_phone, owner_name").eq("station_id", stationId).maybeSingle()
      .then(async ({ data: owner }: any) => {
        if (owner?.owner_phone) {
          const ownerConvId = await getOrCreateConvForPhone(supabase, owner.owner_phone, owner.owner_name);
          const ownerMsg = `📢 طلب حجز جديد!\n\n🔢 رقم الحجز: #${booking.booking_number}\n📱 العميل: ${customerName || phone}\n🧽 الخدمة: ${service?.name} - ${service?.price} د.ع\n📅 التاريخ: ${dateLabel}${bookingTime ? "\n⏰ الوقت: " + bookingTime : ""}\n\nهل توافق على الحجز؟`;

          const ownerButtons = [
            { id: "approve_yes", title: "✅ موافق" },
            { id: "approve_no", title: "❌ غير موافق" },
            { id: "approve_reschedule", title: "📅 تعديل الموعد" },
          ];

          const ownerWaId = await sendWhatsAppInteractive(owner.owner_phone, ownerMsg, ownerButtons, settings);
          if (ownerConvId) {
            saveBotMessage(supabase, ownerConvId, ownerMsg, ownerWaId);
            await getOrCreateSession(supabase, owner.owner_phone);
            updateSession(supabase, owner.owner_phone, {
              current_step: "owner_approve_reject", pending_booking_id: booking.id, selected_station_id: stationId,
            });
          }
        }
      }).catch((e: any) => console.error("Owner notify error:", e));
  }

  // Notify admin (fire-and-forget)
  if (booking) {
    const adminMsg = `🔔 حجز جديد!\n\n🔢 #${booking.booking_number}\n📱 العميل: ${customerName || phone}\n🏪 المحطة: ${station?.name}\n🧽 الخدمة: ${service?.name} - ${service?.price} د.ع\n📅 ${dateLabel}${bookingTime ? "\n⏰ " + bookingTime : ""}`;
    notifyAdmin(supabase, settings, adminMsg);
    incrementCustomerBookings(supabase, phone, "whatsapp");
  }

  await custSend;
  return true;
}

// ==================== CANCEL / BOOKINGS ====================

async function showMyBookings(supabase: any, phone: string, convId: string, settings: Record<string, string>) {
  const { data: bookings } = await supabase.from("bookings")
    .select("booking_number, booking_date, booking_time, status, stations(name), services(name, price)")
    .eq("customer_phone", phone).in("status", ["pending", "confirmed"]).order("booking_date").limit(10);

  if (!bookings || bookings.length === 0) {
    await sendAndSave(supabase, convId, phone, "لا توجد لديك حجوزات نشطة حالياً.\nأرسل أي رسالة لحجز جديد.", settings);
    return true;
  }

  let msg = "📋 حجوزاتك النشطة:\n\n";
  bookings.forEach((b: any) => {
    const label = b.status === "confirmed" ? "مؤكد ✅" : "قيد الانتظار ⏳";
    msg += `🔢 #${b.booking_number} - ${label}\n   🏪 ${b.stations?.name}\n   🧽 ${b.services?.name} - ${b.services?.price} د.ع\n   📅 ${b.booking_date}${b.booking_time ? " ⏰ " + b.booking_time.substring(0, 5) : ""}\n\n`;
  });
  msg += `لإلغاء حجز أرسل: إلغاء #رقم_الحجز`;

  await sendAndSave(supabase, convId, phone, msg, settings);
  return true;
}

async function handleCancelBooking(supabase: any, phone: string, convId: string, settings: Record<string, string>, bookingNum: number) {
  const { data: booking } = await supabase.from("bookings")
    .select("id, booking_number, status, stations(name)").eq("booking_number", bookingNum).eq("customer_phone", phone).maybeSingle();

  if (!booking) {
    await sendAndSave(supabase, convId, phone, `❌ لم يتم العثور على حجز #${bookingNum}.\nأرسل "حجوزاتي" لعرض حجوزاتك.`, settings);
    return true;
  }

  if (booking.status === "cancelled" || booking.status === "completed") {
    await sendAndSave(supabase, convId, phone, `⚠️ الحجز #${bookingNum} ${booking.status === "cancelled" ? "ملغي مسبقاً" : "مكتمل"}.`, settings);
    return true;
  }

  updateSession(supabase, phone, { current_step: "confirm_cancel", selected_date: String(bookingNum) });
  await sendAndSave(supabase, convId, phone, `⚠️ هل تريد إلغاء الحجز #${bookingNum} في ${booking.stations?.name}?\n\nأرسل "نعم" للتأكيد\nأرسل "لا" للتراجع`, settings);
  return true;
}

async function handleConfirmCancel(supabase: any, phone: string, convId: string, settings: Record<string, string>, session: any, input: string) {
  const bookingNum = parseInt(session.selected_date);
  if (input === "نعم" || input === "اي" || input === "أي") {
    supabase.from("bookings").update({ status: "cancelled" }).eq("booking_number", bookingNum).eq("customer_phone", phone).then(() => {}).catch(() => {});
    const cancelMsg = replaceTemplateVars(settings.BOT_CANCELLATION_MESSAGE || "تم إلغاء الحجز #{booking_number} بنجاح.", { booking_number: String(bookingNum) });
    await sendAndSave(supabase, convId, phone, cancelMsg + "\nأرسل أي رسالة لحجز جديد.", settings);
  } else {
    await sendAndSave(supabase, convId, phone, "تم التراجع عن الإلغاء. ✅", settings);
  }
  updateSession(supabase, phone, { current_step: "idle", selected_station_id: null, selected_service_id: null, selected_date: null });
  return true;
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // GET: Webhook verification (must load settings for verify token)
  if (req.method === "GET") {
    const settings = await getSettings(supabase);
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

  // POST: Incoming messages - read body THEN return 200 immediately
  if (req.method === "POST") {
    const bodyText = await req.text();

    // Process everything in background - return 200 to WhatsApp instantly
    const processing = (async () => {
      try {
        const settings = await getSettings(supabase);

        if (settings.WHATSAPP_APP_SECRET) {
          const sig = req.headers.get("x-hub-signature-256") || "";
          if (!(await verifySignature(bodyText, sig, settings.WHATSAPP_APP_SECRET))) {
            console.error("Invalid signature");
            return;
          }
        }

        let body: any;
        try { body = JSON.parse(bodyText); } catch { return; }

        for (const entry of (body.entry || [])) {
          for (const change of (entry.changes || [])) {
            const value = change.value;

            // Status updates - fire and forget
            if (value.statuses) {
              for (const status of value.statuses) {
                supabase.from("messages").update({ status: status.status }).eq("whatsapp_message_id", status.id).then(() => {}).catch(() => {});
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

                // Duplicate check + download media in parallel (don't block each other)
                const [dupResult, mediaUrl] = await Promise.all([
                  msg.id ? supabase.from("messages").select("id").eq("whatsapp_message_id", msg.id).maybeSingle() : Promise.resolve({ data: null }),
                  (mediaId && settings.WHATSAPP_ACCESS_TOKEN) ? downloadAndStoreMedia(mediaId, settings.WHATSAPP_ACCESS_TOKEN, supabase, messageType, mediaMime) : Promise.resolve(null),
                ]);

                if (dupResult.data) continue;

                // Find or create conversation
                const now = new Date().toISOString();
                let convId: string;
                const { data: existingConv } = await supabase.from("conversations").select("id").eq("customer_phone", phone).eq("status", "open").maybeSingle();

                if (existingConv) {
                  convId = existingConv.id;
                  // Update conversation timestamp in background - don't block
                  supabase.from("conversations").update({ last_message_at: now, customer_name: contactName }).eq("id", convId).then(() => {}).catch(() => {});
                } else {
                  const { data: newConv } = await supabase.from("conversations")
                    .insert({ customer_phone: phone, customer_name: contactName, status: "open", last_message_at: now, platform: "whatsapp" })
                    .select("id").single();
                  if (!newConv) continue;
                  convId = newConv.id;
                }

                // Save inbound message in background - don't block bot logic
                supabase.from("messages").insert({
                  conversation_id: convId, direction: "inbound", content,
                  message_type: messageType, whatsapp_message_id: msg.id,
                  status: "delivered", media_url: mediaUrl, platform: "whatsapp",
                }).then(() => {}).catch(() => {});

                // Auto-register bot customer (fire-and-forget)
                upsertBotCustomer(supabase, phone, contactName !== phone ? contactName : null, "whatsapp");

                // === ROUTING: Owner or Customer? ===
                const owner = await checkIfOwner(supabase, phone);

                if (owner) {
                  const buttonId = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id;
                  const actualInput = buttonId || content;
                  await handleOwnerLogic(supabase, phone, actualInput, convId, settings, owner);
                } else if (messageType === "text" || messageType === "location" || messageType === "interactive") {
                  const buttonId = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id;
                  const actualInput = buttonId || content;
                  await handleCustomerLogic(supabase, phone, actualInput, convId, settings, locationData, contactName);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Webhook error:", error);
      }
    })();

    // Use EdgeRuntime.waitUntil if available, otherwise let the promise run
    try {
      // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
      EdgeRuntime.waitUntil(processing);
    } catch {
      // Fallback: await processing if EdgeRuntime not available
      await processing;
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response("Method not allowed", { status: 405 });
});
