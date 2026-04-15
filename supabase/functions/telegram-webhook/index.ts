import { createClient } from "npm:@supabase/supabase-js@2";

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

// ==================== TELEGRAM MESSAGING ====================

async function sendTelegramMessage(chatId: number | string, text: string, token: string, replyMarkup?: any): Promise<number | null> {
  try {
    const body: any = { chat_id: chatId, text, parse_mode: "HTML" };
    if (replyMarkup) body.reply_markup = replyMarkup;
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data.ok ? data.result.message_id : null;
  } catch { return null; }
}

// Inline keyboard helper
function inlineKeyboard(buttons: { text: string; callback_data: string }[][]) {
  return { inline_keyboard: buttons };
}

// Send + save to DB in parallel
async function sendAndSave(supabase: any, convId: string, chatId: number | string, message: string, token: string, replyMarkup?: any) {
  const msgId = await sendTelegramMessage(chatId, message, token, replyMarkup);
  saveBotMessage(supabase, convId, message, msgId ? String(msgId) : null);
  return msgId;
}

function saveBotMessage(supabase: any, convId: string, content: string, telegramMsgId: string | null) {
  const now = new Date().toISOString();
  Promise.all([
    supabase.from("messages").insert({
      conversation_id: convId, direction: "outbound", content, message_type: "text",
      whatsapp_message_id: telegramMsgId, status: "sent", platform: "telegram",
    }),
    supabase.from("conversations").update({ last_message_at: now }).eq("id", convId),
  ]).catch((e: any) => console.error("saveBotMessage error:", e));
}

// ==================== SESSION ====================

async function getOrCreateSession(supabase: any, chatId: string) {
  const { data } = await supabase.from("bot_sessions").select("*").eq("customer_phone", chatId).maybeSingle();
  if (data && new Date(data.expires_at) > new Date()) return data;
  const sessionData = {
    customer_phone: chatId, current_step: "idle",
    selected_station_id: null, selected_service_id: null, selected_date: null, pending_booking_id: null,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), updated_at: new Date().toISOString(),
  };
  if (data) {
    supabase.from("bot_sessions").update(sessionData).eq("id", data.id).then(() => {}).catch(() => {});
    return { ...data, ...sessionData };
  }
  const { data: ns } = await supabase.from("bot_sessions").insert(sessionData).select().single();
  return ns;
}

function updateSession(supabase: any, chatId: string, updates: Record<string, any>) {
  supabase.from("bot_sessions").update({
    ...updates, expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), updated_at: new Date().toISOString(),
  }).eq("customer_phone", chatId).then(() => {}).catch((e: any) => console.error("updateSession error:", e));
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
  // Average city driving ~40 km/h
  return Math.max(1, Math.round(distKm / 40 * 60));
}

function replaceTemplateVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

async function getCustomerName(supabase: any, convId: string): Promise<string | null> {
  const { data } = await supabase.from("conversations").select("customer_name").eq("id", convId).single();
  return data?.customer_name || null;
}

async function getOrCreateConvForChat(supabase: any, chatId: string, name?: string): Promise<string | null> {
  const { data: existing } = await supabase.from("conversations").select("id").eq("customer_phone", chatId).eq("status", "open").maybeSingle();
  if (existing) return existing.id;
  const { data: newConv } = await supabase.from("conversations")
    .insert({ customer_phone: chatId, customer_name: name || chatId, status: "open", last_message_at: new Date().toISOString(), platform: "telegram" })
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

function notifyAdminTelegram(supabase: any, token: string, settings: Record<string, string>, message: string) {
  const adminChatId = settings.ADMIN_TELEGRAM_CHAT_ID;
  if (!adminChatId) return;
  (async () => {
    try {
      const convId = await getOrCreateConvForChat(supabase, adminChatId, "المسؤول");
      const msgId = await sendTelegramMessage(adminChatId, message, token);
      if (convId) saveBotMessage(supabase, convId, message, msgId ? String(msgId) : null);
    } catch (e) { console.error("Admin telegram notify error:", e); }
  })();
}

// ==================== CHECK IF OWNER ====================

async function checkIfOwner(supabase: any, chatId: string) {
  const { data } = await supabase.from("station_owners")
    .select("id, owner_name, station_id, stations(name)")
    .eq("owner_phone", chatId).maybeSingle();
  return data;
}

// ==================== OWNER BOT LOGIC ====================

async function handleOwnerLogic(
  supabase: any, chatId: string, content: string, convId: string, token: string, settings: Record<string, string>, owner: any
): Promise<boolean> {
  const session = await getOrCreateSession(supabase, chatId);
  if (!session) return false;
  const input = content.trim();
  const step = session.current_step;

  // Reset
  if (input === "0" || input === "/start") {
    updateSession(supabase, chatId, { current_step: "owner_idle", selected_station_id: null, pending_booking_id: null });
    return await showOwnerMenu(supabase, chatId, convId, token, settings, owner);
  }

  // Owner idle - show menu
  if (step === "idle" || step === "owner_idle") {
    return await showOwnerMenu(supabase, chatId, convId, token, settings, owner);
  }

  // Owner accepting a booking
  if (step === "owner_approve_reject") {
    const bookingId = session.pending_booking_id;
    if (!bookingId) {
      updateSession(supabase, chatId, { current_step: "owner_idle" });
      return await showOwnerMenu(supabase, chatId, convId, token, settings, owner);
    }

    if (input === "موافق" || input === "approve_yes") {
      updateSession(supabase, chatId, { current_step: "owner_offer" });
      const msg = "✅ تمت الموافقة!\n\nهل يوجد عرض خاص ترغب بإرفاقه للعميل اليوم؟\n(اكتب العرض أو أرسل \"لا\" للتخطي)";
      await sendAndSave(supabase, convId, chatId, msg, token);
      return true;
    }

    if (input === "رفض" || input === "approve_no") {
      const [, bookingResult] = await Promise.all([
        supabase.from("bookings").update({ status: "cancelled" }).eq("id", bookingId),
        supabase.from("bookings").select("customer_phone, booking_number, stations(name)").eq("id", bookingId).single(),
      ]);
      const booking = bookingResult.data;

      const ownerMsg = "✅ تم رفض الحجز وإبلاغ العميل.\n\nأرسل أي رسالة لعرض القائمة.";
      const promises: Promise<any>[] = [sendAndSave(supabase, convId, chatId, ownerMsg, token)];

      if (booking) {
        const custConvId = await getOrCreateConvForChat(supabase, booking.customer_phone);
        if (custConvId) {
          const custMsg = `❌ عذراً، تم رفض حجزك #${booking.booking_number} في ${booking.stations?.name}.\n\nيمكنك حجز موعد آخر بإرسال أي رسالة.`;
          promises.push(sendAndSave(supabase, custConvId, booking.customer_phone, custMsg, token));
        }
      }

      await Promise.all(promises);
      updateSession(supabase, chatId, { current_step: "owner_idle", pending_booking_id: null });
      return true;
    }

    const msg = "❌ أرسل \"موافق\" أو \"رفض\"";
    await sendAndSave(supabase, convId, chatId, msg, token);
    return true;
  }

  // Owner adding offer
  if (step === "owner_offer") {
    const bookingId = session.pending_booking_id;
    const offer = (input === "لا" || input === "no") ? null : input;
    if (offer) supabase.from("bookings").update({ owner_offer: offer }).eq("id", bookingId).then(() => {}).catch(() => {});

    updateSession(supabase, chatId, { current_step: "owner_note" });
    const msg = "هل توجد ملاحظة إضافية للعميل؟\n(اكتب الملاحظة أو أرسل \"لا\" للتخطي)";
    await sendAndSave(supabase, convId, chatId, msg, token);
    return true;
  }

  // Owner adding note
  if (step === "owner_note") {
    const bookingId = session.pending_booking_id;
    const note = (input === "لا" || input === "no") ? null : input;

    const updates: Promise<any>[] = [
      supabase.from("bookings").update({ status: "confirmed", ...(note ? { owner_note: note } : {}) }).eq("id", bookingId),
    ];

    const [, bookingResult] = await Promise.all([
      Promise.all(updates),
      supabase.from("bookings")
        .select("booking_number, customer_phone, booking_date, booking_time, owner_offer, owner_note, stations(name), services(name, price)")
        .eq("id", bookingId).single(),
    ]);
    const booking = bookingResult.data;

    const ownerMsg = "✅ تم تأكيد الحجز وإرسال التفاصيل للعميل.\n\nأرسل أي رسالة لعرض القائمة.";
    const ownerSend = sendAndSave(supabase, convId, chatId, ownerMsg, token);

    if (booking) {
      const custConvId = await getOrCreateConvForChat(supabase, booking.customer_phone);
      if (custConvId) {
        const confirmTemplate = settings.BOT_CONFIRMATION_MESSAGE || "✅ تم تأكيد حجزك!\n📍 المحطة: {station}\n🔧 الخدمة: {service}\n📅 التاريخ: {date}\n🕐 الوقت: {time}\n📋 رقم الحجز: #{booking_number}";
        let custMsg = replaceTemplateVars(confirmTemplate, {
          station: booking.stations?.name || "",
          service: booking.services?.name || "",
          date: booking.booking_date,
          time: booking.booking_time ? booking.booking_time.substring(0, 5) : "-",
          booking_number: String(booking.booking_number),
        });
        if (booking.services?.price) custMsg += `\n💰 السعر: ${booking.services.price} د.ع`;
        if (booking.owner_offer) custMsg += `\n\n🎁 عرض خاص لك اليوم: ${booking.owner_offer}`;
        if (note) custMsg += `\n📝 ملاحظة من الإدارة: ${note}`;
        else if (booking.owner_note) custMsg += `\n📝 ملاحظة من الإدارة: ${booking.owner_note}`;
        if (settings.BOT_THANK_YOU_ENABLED === "true" && settings.BOT_THANK_YOU_MESSAGE) {
          custMsg += `\n\n${settings.BOT_THANK_YOU_MESSAGE}`;
        } else {
          custMsg += "\n\nنتمنى لك تجربة رائعة! 🚗✨";
        }
        sendAndSave(supabase, custConvId, booking.customer_phone, custMsg, token);
      }
    }

    await ownerSend;
    updateSession(supabase, chatId, { current_step: "owner_idle", pending_booking_id: null });
    return true;
  }

  // Owner viewing pending bookings
  if (step === "owner_view_pending") {
    const { data: pendingBookings } = await supabase.from("bookings")
      .select("id, booking_number, customer_phone, customer_name, booking_date, booking_time, services(name, price)")
      .eq("station_id", owner.station_id).eq("status", "pending").order("created_at");

    const idx = parseInt(input) - 1;
    if (isNaN(idx) || !pendingBookings || pendingBookings.length === 0 || idx < 0 || idx >= pendingBookings.length) {
      const msg = pendingBookings && pendingBookings.length > 0
        ? `❌ اختيار غير صحيح. أرسل رقم من 1 إلى ${pendingBookings.length}`
        : "لا توجد حجوزات معلقة حالياً.";
      await sendAndSave(supabase, convId, chatId, msg, token);
      return true;
    }

    const b = pendingBookings[idx];
    updateSession(supabase, chatId, { current_step: "owner_approve_reject", pending_booking_id: b.id });

    const msg = `📋 تفاصيل الحجز #${b.booking_number}:\n\n📱 العميل: ${b.customer_name || b.customer_phone}\n🧽 الخدمة: ${b.services?.name} - ${b.services?.price} د.ع\n📅 التاريخ: ${b.booking_date}${b.booking_time ? "\n⏰ الوقت: " + b.booking_time.substring(0, 5) : ""}`;

    const keyboard = inlineKeyboard([
      [{ text: "✅ موافق", callback_data: "approve_yes" }, { text: "❌ رفض", callback_data: "approve_no" }],
    ]);
    await sendAndSave(supabase, convId, chatId, msg, token, keyboard);
    return true;
  }

  // Default: show menu
  return await showOwnerMenu(supabase, chatId, convId, token, settings, owner);
}

async function showOwnerMenu(supabase: any, chatId: string, convId: string, token: string, settings: Record<string, string>, owner: any) {
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

  await sendAndSave(supabase, convId, chatId, msg, token);
  updateSession(supabase, chatId, {
    current_step: pendingBookings && pendingBookings.length > 0 ? "owner_view_pending" : "owner_idle",
    selected_station_id: owner.station_id,
  });
  return true;
}

// ==================== CUSTOMER BOT LOGIC ====================

async function handleCustomerLogic(
  supabase: any, chatId: string, content: string, convId: string, token: string, settings: Record<string, string>,
  locationData?: { latitude: number; longitude: number }
): Promise<boolean> {
  if (settings.BOT_ENABLED !== "true") return false;

  const session = await getOrCreateSession(supabase, chatId);
  if (!session) return false;

  const input = content.trim();

  // "0" or /start resets
  if (input === "0" || input === "/start") {
    updateSession(supabase, chatId, { current_step: "idle", selected_station_id: null, selected_service_id: null, selected_date: null, pending_booking_id: null });
    return await showCustomerWelcome(supabase, chatId, convId, token, settings);
  }

  // Check bookings command
  if (input === "حجوزاتي" || input === "حجوزات" || input === "/bookings") {
    return await showMyBookings(supabase, chatId, convId, token, settings);
  }

  // Cancel booking
  const cancelMatch = input.match(/^(?:إلغاء|الغاء|cancel|\/cancel)\s*#?(\d+)$/i);
  if (cancelMatch) return await handleCancelBooking(supabase, chatId, convId, token, settings, parseInt(cancelMatch[1]));

  const step = session.current_step;

  // Handle location message
  if (locationData) {
    return await handleLocationMessage(supabase, chatId, convId, token, settings, locationData);
  }

  // Cancel confirmation
  if (step === "confirm_cancel") return await handleConfirmCancel(supabase, chatId, convId, token, settings, session, input);

  // Waiting for owner response
  if (step === "awaiting_owner_response") {
    const msg = "⏳ حجزك قيد المراجعة من قبل إدارة المغسلة.\nسنبلغك فور الرد.";
    const kb = inlineKeyboard([
      [{ text: "📋 حجوزاتي", callback_data: "my_bookings" }],
      [{ text: "🔙 القائمة الرئيسية", callback_data: "go_back" }],
    ]);
    await sendAndSave(supabase, convId, chatId, msg, token, kb);
    return true;
  }

  // Idle
  if (step === "idle") {
    return await showCustomerWelcome(supabase, chatId, convId, token, settings);
  }

  // Station search mode - user types search text
  if (step === "searching_station") {
    // If it's a button callback, route to station selection
    if (input.startsWith("sid_") || input.startsWith("stations_page_") || input === "search_station") {
      return await handleStationSelection(supabase, chatId, convId, token, settings, session, input);
    }
    updateSession(supabase, chatId, { current_step: "awaiting_station" });
    return await searchStations(supabase, chatId, convId, token, input);
  }

  // Awaiting station selection
  if (step === "awaiting_station") return await handleStationSelection(supabase, chatId, convId, token, settings, session, input);

  // Awaiting service
  if (step === "awaiting_service") {
    // Allow station navigation even while in service step
    if (input.startsWith("sid_") || input.startsWith("stations_page_") || input === "search_station") {
      updateSession(supabase, chatId, { current_step: "awaiting_station" });
      return await handleStationSelection(supabase, chatId, convId, token, settings, session, input);
    }
    return await handleServiceSelection(supabase, chatId, convId, token, settings, session, input);
  }

  // Awaiting day
  if (step === "awaiting_day") return await handleDaySelection(supabase, chatId, convId, token, settings, session, input);

  // Awaiting time
  if (step === "awaiting_time") return await handleTimeSelection(supabase, chatId, convId, token, settings, session, input);

  // Awaiting station confirm (after location)
  if (step === "awaiting_station_confirm") {
    if (input === "حجز" || input === "book_nearest") {
      return await showServicesForStation(supabase, chatId, convId, token, settings, session.selected_station_id, "");
    }
    // Direct station ID from nearby/search buttons
    const sidMatch2 = input.match(/^sid_(.+)$/);
    if (sidMatch2) {
      return await showServicesForStation(supabase, chatId, convId, token, settings, sidMatch2[1], "");
    }
    // Handle nearby station buttons (near_station_0, near_station_1, near_station_2)
    const nearMatch = input.match(/^near_station_(\d+)$/);
    if (nearMatch) {
      try {
        const nearbyIds = JSON.parse(session.selected_date || "[]");
        const idx = parseInt(nearMatch[1]);
        if (nearbyIds[idx]) {
          return await showServicesForStation(supabase, chatId, convId, token, settings, nearbyIds[idx], "");
        }
      } catch {}
    }
    if (input === "go_back") {
      updateSession(supabase, chatId, { current_step: "idle" });
      return await showCustomerWelcome(supabase, chatId, convId, token, settings);
    }
    // Try numeric selection for other stations
    return await handleStationSelection(supabase, chatId, convId, token, settings, session, input);
  }

  // Unknown step
  const unknownMsg = settings.BOT_UNKNOWN_MESSAGE || "عذراً، لم أفهم طلبك. أرسل 'مرحبا' للبدء من جديد.";
  const unknownKb = inlineKeyboard([[{ text: "🔙 القائمة الرئيسية", callback_data: "go_back" }]]);
  await sendAndSave(supabase, convId, chatId, unknownMsg, token, unknownKb);
  updateSession(supabase, chatId, { current_step: "idle" });
  return true;
}

const STATIONS_PER_PAGE = 5;

async function showCustomerWelcome(supabase: any, chatId: string, convId: string, token: string, settings: Record<string, string>) {
  const welcome = settings.BOT_WELCOME_MESSAGE || "مرحباً بك في خدمة غسيل السيارات! 🚗✨";
  const { count } = await supabase.from("stations").select("id", { count: "exact", head: true }).eq("is_active", true);
  const total = count || 0;

  let msg = `${welcome}\n\n📍 شارك موقعك لنحدد أقرب مغسلة إليك.`;
  if (total > 0) msg += `\n\n🏪 أو اختر من ${total} مغسلة متاحة:`;
  else msg += "\n\nعذراً، لا توجد مغاسل متاحة حالياً.";

  const rows: { text: string; callback_data: string }[][] = [];
  if (total > 0) rows.push([{ text: `📋 عرض المغاسل (${total})`, callback_data: "stations_page_0" }]);
  rows.push([{ text: "🔍 بحث باسم المغسلة", callback_data: "search_station" }]);
  rows.push([{ text: "📋 حجوزاتي", callback_data: "my_bookings" }]);

  await sendAndSave(supabase, convId, chatId, msg, token, inlineKeyboard(rows));

  const locationKeyboard = {
    keyboard: [[{ text: "📍 مشاركة موقعي", request_location: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
  await sendTelegramMessage(chatId, "أو شارك موقعك لنحدد أقرب مغسلة إليك 👇", token, locationKeyboard);
  updateSession(supabase, chatId, { current_step: "awaiting_station" });
  return true;
}

async function showStationsPage(supabase: any, chatId: string, convId: string, token: string, page: number) {
  const offset = page * STATIONS_PER_PAGE;
  const [listResult, countResult] = await Promise.all([
    supabase.from("stations").select("id, name, address").eq("is_active", true).order("created_at").range(offset, offset + STATIONS_PER_PAGE - 1),
    supabase.from("stations").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);
  const stations = listResult.data || [];
  const total = countResult.count || 0;
  const totalPages = Math.ceil(total / STATIONS_PER_PAGE);

  if (stations.length === 0) {
    const kb = inlineKeyboard([[{ text: "🔙 القائمة الرئيسية", callback_data: "go_back" }]]);
    await sendAndSave(supabase, convId, chatId, "لا توجد مغاسل في هذه الصفحة.", token, kb);
    return true;
  }

  let msg = `🏪 المغاسل المتاحة (${page + 1}/${totalPages}):\n`;
  const rows: { text: string; callback_data: string }[][] = [];
  stations.forEach((s: any) => {
    msg += `\n• ${s.name}${s.address ? ` - ${s.address}` : ""}`;
    rows.push([{ text: `🏪 ${s.name}`, callback_data: `sid_${s.id}` }]);
  });

  // Pagination buttons
  const navRow: { text: string; callback_data: string }[] = [];
  if (page > 0) navRow.push({ text: "◀️ السابق", callback_data: `stations_page_${page - 1}` });
  navRow.push({ text: `${page + 1}/${totalPages}`, callback_data: "noop" });
  if (page < totalPages - 1) navRow.push({ text: "التالي ▶️", callback_data: `stations_page_${page + 1}` });
  if (navRow.length > 0) rows.push(navRow);

  rows.push([{ text: "🔍 بحث", callback_data: "search_station" }, { text: "🔙 الرئيسية", callback_data: "go_back" }]);

  await sendAndSave(supabase, convId, chatId, msg, token, inlineKeyboard(rows));
  return true;
}

async function searchStations(supabase: any, chatId: string, convId: string, token: string, query: string) {
  const { data: stations } = await supabase.from("stations").select("id, name, address")
    .eq("is_active", true).or(`name.ilike.%${query}%,address.ilike.%${query}%`).order("created_at").limit(10);

  if (!stations || stations.length === 0) {
    const kb = inlineKeyboard([
      [{ text: "🔍 بحث جديد", callback_data: "search_station" }],
      [{ text: "📋 عرض الكل", callback_data: "stations_page_0" }],
      [{ text: "🔙 الرئيسية", callback_data: "go_back" }],
    ]);
    await sendAndSave(supabase, convId, chatId, `❌ لم يتم العثور على مغاسل بـ "${query}".`, token, kb);
    return true;
  }

  let msg = `🔍 نتائج البحث عن "${query}" (${stations.length}):\n`;
  const rows: { text: string; callback_data: string }[][] = [];
  stations.forEach((s: any) => {
    msg += `\n• ${s.name}${s.address ? ` - ${s.address}` : ""}`;
    rows.push([{ text: `🏪 ${s.name}`, callback_data: `sid_${s.id}` }]);
  });
  rows.push([{ text: "🔍 بحث جديد", callback_data: "search_station" }, { text: "🔙 الرئيسية", callback_data: "go_back" }]);

  await sendAndSave(supabase, convId, chatId, msg, token, inlineKeyboard(rows));
  return true;
}

async function handleLocationMessage(supabase: any, chatId: string, convId: string, token: string, settings: Record<string, string>, loc: { latitude: number; longitude: number }) {
  const { data: stations } = await supabase.from("stations")
    .select("id, name, address, latitude, longitude").eq("is_active", true);

  if (!stations || stations.length === 0) {
    await sendAndSave(supabase, convId, chatId, "عذراً، لا توجد مغاسل متاحة حالياً.", token);
    return true;
  }

  const MAX_RADIUS_KM = 30;
  const nearby = stations
    .filter((s: any) => s.latitude && s.longitude)
    .map((s: any) => ({ ...s, distance: haversineDistance(loc.latitude, loc.longitude, s.latitude, s.longitude) }))
    .filter((s: any) => s.distance <= MAX_RADIUS_KM)
    .sort((a: any, b: any) => a.distance - b.distance);

  if (nearby.length === 0) {
    const kb = inlineKeyboard([[{ text: "🔙 اختيار يدوي", callback_data: "go_back" }]]);
    await sendTelegramMessage(chatId, "تم استلام موقعك ✅", token, { remove_keyboard: true });
    await sendAndSave(supabase, convId, chatId, `😔 لا توجد مغاسل ضمن ${MAX_RADIUS_KM} كم من موقعك.\nيمكنك اختيار مغسلة يدوياً من القائمة.`, token, kb);
    return true;
  }

  // Remove location reply keyboard
  await sendTelegramMessage(chatId, "تم استلام موقعك ✅", token, { remove_keyboard: true });

  const nearest = nearby[0];
  const distKm = nearest.distance.toFixed(1);
  const mins = estimateMinutes(nearest.distance);
  const mapsLink = `https://www.google.com/maps/dir/${loc.latitude},${loc.longitude}/${nearest.latitude},${nearest.longitude}`;

  let msg = `📍 أقرب مغسلة إليك:\n\n🏪 ${nearest.name}${nearest.address ? `\n📌 ${nearest.address}` : ""}\n📏 ${distKm} كم · ~${mins} دقيقة\n🗺️ <a href="${mapsLink}">عرض الاتجاهات</a>`;

  const btnRows: { text: string; callback_data: string }[][] = [];
  btnRows.push([{ text: `✅ حجز في ${nearest.name} (${distKm} كم · ${mins} د)`, callback_data: "book_nearest" }]);

  // Show all other nearby stations within 30km (up to 9 more)
  const others = nearby.slice(1, 10);
  if (others.length > 0) {
    msg += "\n\n🏪 مغاسل أخرى قريبة:";
    others.forEach((s: any, i: number) => {
      const km = s.distance.toFixed(1);
      const m = estimateMinutes(s.distance);
      msg += `\n${i + 2}. ${s.name} - ${km} كم · ~${m} د`;
      btnRows.push([{ text: `🏪 ${s.name} (${km} كم · ${m} د)`, callback_data: `near_station_${i}` }]);
    });
  }
  btnRows.push([{ text: "🔙 القائمة الرئيسية", callback_data: "go_back" }]);

  await sendAndSave(supabase, convId, chatId, msg, token, inlineKeyboard(btnRows));

  const nearbyIds = others.map((s: any) => s.id);
  updateSession(supabase, chatId, { current_step: "awaiting_station_confirm", selected_station_id: nearest.id, selected_date: JSON.stringify(nearbyIds) });
  return true;
}

async function handleStationSelection(supabase: any, chatId: string, convId: string, token: string, settings: Record<string, string>, session: any, input: string) {
  // Direct station ID selection (from paginated/search buttons)
  const sidMatch = input.match(/^sid_(.+)$/);
  if (sidMatch) {
    return await showServicesForStation(supabase, chatId, convId, token, settings, sidMatch[1], "");
  }

  // Pagination
  const pageMatch = input.match(/^stations_page_(\d+)$/);
  if (pageMatch) {
    return await showStationsPage(supabase, chatId, convId, token, parseInt(pageMatch[1]));
  }

  // Search mode
  if (input === "search_station") {
    updateSession(supabase, chatId, { current_step: "searching_station" });
    const kb = inlineKeyboard([[{ text: "🔙 الرئيسية", callback_data: "go_back" }]]);
    await sendAndSave(supabase, convId, chatId, "🔍 اكتب اسم المغسلة أو جزء منه للبحث:", token, kb);
    return true;
  }

  // Numeric index as fallback (for backward compatibility with few stations)
  const { data: stations } = await supabase.from("stations").select("id, name").eq("is_active", true).order("created_at");
  if (!stations || stations.length === 0) {
    const kb = inlineKeyboard([[{ text: "🔙 القائمة الرئيسية", callback_data: "go_back" }]]);
    await sendAndSave(supabase, convId, chatId, "عذراً، لا توجد مغاسل متاحة حالياً.", token, kb);
    return true;
  }
  const idx = parseInt(input) - 1;
  if (isNaN(idx) || idx < 0 || idx >= stations.length) {
    const kb = inlineKeyboard([[{ text: "🔙 القائمة الرئيسية", callback_data: "go_back" }]]);
    await sendAndSave(supabase, convId, chatId, "❌ اختيار غير صحيح، حاول مرة أخرى.", token, kb);
    return true;
  }

  return await showServicesForStation(supabase, chatId, convId, token, settings, stations[idx].id, stations[idx].name);
}

async function showServicesForStation(supabase: any, chatId: string, convId: string, token: string, settings: Record<string, string>, stationId: string, stationName: string) {
  // If stationName not provided, fetch it
  if (!stationName) {
    const { data: st } = await supabase.from("stations").select("name").eq("id", stationId).single();
    stationName = st?.name || "";
  }

  const { data: services } = await supabase.from("services").select("id, name, price")
    .eq("is_active", true).or(`station_id.eq.${stationId},station_id.is.null`).order("sort_order");

  if (!services || services.length === 0) {
    await sendAndSave(supabase, convId, chatId, `عذراً، لا توجد خدمات متاحة في ${stationName} حالياً.\nأرسل 0 للعودة`, token, { remove_keyboard: true });
    return true;
  }

  let msg = `✅ اخترت: ${stationName}\n\nاختر الخدمة:\n`;
  services.forEach((s: any, i: number) => { msg += `${i + 1}. ${s.name} - ${s.price} د.ع\n`; });
  msg += "\nأرسل رقم الخدمة\nأرسل 0 للعودة";

  // Inline keyboard for services
  const rows = services.map((s: any, i: number) => [{ text: `${i + 1}. ${s.name} - ${s.price}`, callback_data: `service_${i + 1}` }]);
  const keyboard = inlineKeyboard(rows);

  await sendAndSave(supabase, convId, chatId, msg, token, keyboard);
  updateSession(supabase, chatId, { current_step: "awaiting_service", selected_station_id: stationId });
  return true;
}

async function handleServiceSelection(supabase: any, chatId: string, convId: string, token: string, settings: Record<string, string>, session: any, input: string) {
  const stationId = session.selected_station_id;

  const [servicesResult, stationResult] = await Promise.all([
    supabase.from("services").select("id, name, price").eq("is_active", true).or(`station_id.eq.${stationId},station_id.is.null`).order("sort_order"),
    supabase.from("stations").select("*").eq("id", stationId).single(),
  ]);
  const services = servicesResult.data;
  const station = stationResult.data;

  const idx = parseInt(input) - 1;
  if (!services || services.length === 0) {
    const kb = inlineKeyboard([[{ text: "🔙 القائمة الرئيسية", callback_data: "go_back" }]]);
    await sendAndSave(supabase, convId, chatId, "عذراً، لا توجد خدمات متاحة حالياً.", token, kb);
    return true;
  }
  if (isNaN(idx) || idx < 0 || idx >= services.length) {
    const kb = inlineKeyboard([[{ text: "🔙 القائمة الرئيسية", callback_data: "go_back" }]]);
    await sendAndSave(supabase, convId, chatId, "❌ اختيار غير صحيح، حاول مرة أخرى.", token, kb);
    return true;
  }

  const service = services[idx];

  // Instant booking
  if (station.scheduling_type === "instant") {
    if (settings.BOT_AFTER_HOURS_ENABLED === "true") {
      const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
      const [sH, sM] = station.working_hours_start.split(":").map(Number);
      const [eH, eM] = station.working_hours_end.split(":").map(Number);
      if (nowMins < sH * 60 + sM || nowMins >= eH * 60 + eM) {
        const afterMsg = replaceTemplateVars(
          settings.BOT_AFTER_HOURS_MESSAGE || "عذراً، المحطة مغلقة حالياً. ساعات العمل: {working_hours_start} - {working_hours_end}",
          { working_hours_start: station.working_hours_start.substring(0, 5), working_hours_end: station.working_hours_end.substring(0, 5) }
        );
        const ahKb = inlineKeyboard([[{ text: "🔙 القائمة الرئيسية", callback_data: "go_back" }]]);
        await sendAndSave(supabase, convId, chatId, afterMsg, token, ahKb);
        return true;
      }
    }
    return await createBookingAndNotifyOwner(supabase, chatId, convId, token, settings, stationId, service.id, new Date().toISOString().split("T")[0], null);
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

    const rows = days.map((d, i) => [{ text: `${i + 1}. ${d}`, callback_data: `day_${i + 1}` }]);
    const keyboard = inlineKeyboard(rows);

    await sendAndSave(supabase, convId, chatId, msg, token, keyboard);
    updateSession(supabase, chatId, { current_step: "awaiting_day", selected_service_id: service.id });
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
    const kb = inlineKeyboard([[{ text: "🔙 القائمة الرئيسية", callback_data: "go_back" }]]);
    // Check if after hours
    if (settings.BOT_AFTER_HOURS_ENABLED === "true") {
      const nowMins2 = new Date().getHours() * 60 + new Date().getMinutes();
      const [sH2, sM2] = station.working_hours_start.split(":").map(Number);
      const [eH2, eM2] = station.working_hours_end.split(":").map(Number);
      if (nowMins2 < sH2 * 60 + sM2 || nowMins2 >= eH2 * 60 + eM2) {
        const afterMsg = replaceTemplateVars(
          settings.BOT_AFTER_HOURS_MESSAGE || "عذراً، المحطة مغلقة حالياً. ساعات العمل: {working_hours_start} - {working_hours_end}",
          { working_hours_start: station.working_hours_start.substring(0, 5), working_hours_end: station.working_hours_end.substring(0, 5) }
        );
        await sendAndSave(supabase, convId, chatId, afterMsg, token, kb);
        return true;
      }
    }
    const fullyBookedMsg = settings.BOT_FULLY_BOOKED_MESSAGE || "عذراً، جميع المواعيد محجوزة لهذا اليوم. يرجى اختيار يوم آخر.";
    await sendAndSave(supabase, convId, chatId, fullyBookedMsg, token, kb);
    return true;
  }

  let msg = `✅ اخترت: ${service.name} - ${service.price} د.ع\n\nالمواعيد المتاحة اليوم:`;
  available.forEach((s, i) => { msg += `\n${i + 1}. ${s}`; });

  // Inline keyboard for time slots (group 3 per row)
  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < available.length; i += 3) {
    const row = available.slice(i, i + 3).map((s, j) => ({ text: s, callback_data: `time_${i + j + 1}` }));
    rows.push(row);
  }
  const keyboard = inlineKeyboard(rows);

  await sendAndSave(supabase, convId, chatId, msg, token, keyboard);
  updateSession(supabase, chatId, { current_step: "awaiting_time", selected_service_id: service.id, selected_date: today });
  return true;
}

async function handleDaySelection(supabase: any, chatId: string, convId: string, token: string, settings: Record<string, string>, session: any, input: string) {
  const days = [];
  for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() + i); days.push(d.toISOString().split("T")[0]); }

  const idx = parseInt(input) - 1;
  if (isNaN(idx) || idx < 0 || idx >= days.length) {
    const kb = inlineKeyboard([[{ text: "🔙 القائمة الرئيسية", callback_data: "go_back" }]]);
    await sendAndSave(supabase, convId, chatId, "❌ اختيار غير صحيح، حاول مرة أخرى.", token, kb);
    return true;
  }

  return await createBookingAndNotifyOwner(supabase, chatId, convId, token, settings, session.selected_station_id, session.selected_service_id, days[idx], null);
}

async function handleTimeSelection(supabase: any, chatId: string, convId: string, token: string, settings: Record<string, string>, session: any, input: string) {
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
  const isToday = bookingDate === new Date().toISOString().split("T")[0];
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const available = allSlots.filter(s => {
    const [h, m] = s.split(":").map(Number);
    if (isToday && h * 60 + m <= nowMin) return false;
    return !bookedSet.has(s);
  });

  const idx = parseInt(input) - 1;
  if (isNaN(idx) || idx < 0 || idx >= available.length) {
    const kb = inlineKeyboard([[{ text: "🔙 القائمة الرئيسية", callback_data: "go_back" }]]);
    await sendAndSave(supabase, convId, chatId, "❌ اختيار غير صحيح، حاول مرة أخرى.", token, kb);
    return true;
  }

  return await createBookingAndNotifyOwner(supabase, chatId, convId, token, settings, stationId, session.selected_service_id, bookingDate, available[idx]);
}

// ==================== CREATE BOOKING & NOTIFY OWNER ====================

async function createBookingAndNotifyOwner(
  supabase: any, chatId: string, convId: string, token: string, settings: Record<string, string>,
  stationId: string, serviceId: string, bookingDate: string, bookingTime: string | null
) {
  const [stationResult, serviceResult, customerName] = await Promise.all([
    supabase.from("stations").select("name").eq("id", stationId).single(),
    supabase.from("services").select("name, price").eq("id", serviceId).single(),
    getCustomerName(supabase, convId),
  ]);
  const station = stationResult.data;
  const service = serviceResult.data;

  const insertData: any = {
    customer_phone: chatId, customer_name: customerName,
    station_id: stationId, service_id: serviceId,
    booking_date: bookingDate, status: "pending",
  };
  if (bookingTime) insertData.booking_time = bookingTime;

  const { data: booking } = await supabase.from("bookings").insert(insertData).select("id, booking_number").single();

  const dateLabel = new Date(bookingDate).toLocaleDateString("ar-IQ", { calendar: "gregory", weekday: "long", year: "numeric", month: "long", day: "numeric" });
  let custMsg = `⏳ جاري تأكيد حجزك مع إدارة المغسلة...\n\n🏪 ${station?.name}\n🧽 ${service?.name} - ${service?.price} د.ع\n📅 ${dateLabel}`;
  if (bookingTime) custMsg += `\n⏰ ${bookingTime}`;
  custMsg += `\n🔢 رقم الحجز: #${booking?.booking_number || "---"}\n\nسنعلمك بالتفاصيل ورقم الحجز خلال لحظات... ⏳`;

  const waitKb = inlineKeyboard([
    [{ text: "📋 حجوزاتي", callback_data: "my_bookings" }],
    [{ text: "🔙 القائمة الرئيسية", callback_data: "go_back" }],
  ]);
  const custSend = sendAndSave(supabase, convId, chatId, custMsg, token, waitKb);
  updateSession(supabase, chatId, { current_step: "awaiting_owner_response", selected_station_id: null, selected_service_id: null, selected_date: null });

  // Notify station owner (fire-and-forget)
  if (booking) {
    supabase.from("station_owners")
      .select("owner_phone, owner_name").eq("station_id", stationId).maybeSingle()
      .then(async ({ data: owner }: any) => {
        if (owner?.owner_phone) {
          const ownerConvId = await getOrCreateConvForChat(supabase, owner.owner_phone, owner.owner_name);
          const ownerMsg = `📢 طلب حجز جديد!\n\n🔢 رقم الحجز: #${booking.booking_number}\n📱 العميل: ${customerName || chatId}\n🧽 الخدمة: ${service?.name} - ${service?.price} د.ع\n📅 التاريخ: ${dateLabel}${bookingTime ? "\n⏰ الوقت: " + bookingTime : ""}`;

          const keyboard = inlineKeyboard([
            [{ text: "✅ موافق", callback_data: "approve_yes" }, { text: "❌ رفض", callback_data: "approve_no" }],
          ]);

          const ownerMsgId = await sendTelegramMessage(owner.owner_phone, ownerMsg, token, keyboard);
          if (ownerConvId) {
            saveBotMessage(supabase, ownerConvId, ownerMsg, ownerMsgId ? String(ownerMsgId) : null);
            await getOrCreateSession(supabase, owner.owner_phone);
            updateSession(supabase, owner.owner_phone, {
              current_step: "owner_approve_reject", pending_booking_id: booking.id, selected_station_id: stationId,
            });
          }
        }
      }).catch((e: any) => console.error("Owner notify error:", e));
  }

  // Notify admin via Telegram (fire-and-forget)
  if (booking) {
    const adminMsg = `🔔 حجز جديد!\n\n🔢 #${booking.booking_number}\n📱 العميل: ${customerName || chatId}\n🏪 المحطة: ${station?.name}\n🧽 الخدمة: ${service?.name} - ${service?.price} د.ع\n📅 ${dateLabel}${bookingTime ? "\n⏰ " + bookingTime : ""}`;
    notifyAdminTelegram(supabase, token, settings, adminMsg);
    incrementCustomerBookings(supabase, chatId, "telegram");
  }

  await custSend;
  return true;
}

// ==================== CANCEL / BOOKINGS ====================

async function showMyBookings(supabase: any, chatId: string, convId: string, token: string, settings: Record<string, string>) {
  const { data: bookings } = await supabase.from("bookings")
    .select("booking_number, booking_date, booking_time, status, stations(name), services(name, price)")
    .eq("customer_phone", chatId).in("status", ["pending", "confirmed"]).order("booking_date").limit(10);

  if (!bookings || bookings.length === 0) {
    const kb = inlineKeyboard([[{ text: "🔙 القائمة الرئيسية", callback_data: "go_back" }]]);
    await sendAndSave(supabase, convId, chatId, "لا توجد لديك حجوزات نشطة حالياً.", token, kb);
    return true;
  }

  let msg = "📋 حجوزاتك النشطة:\n\n";
  const cancelBtns: { text: string; callback_data: string }[][] = [];
  bookings.forEach((b: any) => {
    const label = b.status === "confirmed" ? "مؤكد ✅" : "قيد الانتظار ⏳";
    msg += `🔢 #${b.booking_number} - ${label}\n   🏪 ${b.stations?.name}\n   🧽 ${b.services?.name} - ${b.services?.price} د.ع\n   📅 ${b.booking_date}${b.booking_time ? " ⏰ " + b.booking_time.substring(0, 5) : ""}\n\n`;
    cancelBtns.push([{ text: `❌ إلغاء #${b.booking_number}`, callback_data: `cancel_${b.booking_number}` }]);
  });
  cancelBtns.push([{ text: "🔙 القائمة الرئيسية", callback_data: "go_back" }]);

  await sendAndSave(supabase, convId, chatId, msg, token, inlineKeyboard(cancelBtns));
  return true;
}

async function handleCancelBooking(supabase: any, chatId: string, convId: string, token: string, settings: Record<string, string>, bookingNum: number) {
  const { data: booking } = await supabase.from("bookings")
    .select("id, booking_number, status, stations(name)").eq("booking_number", bookingNum).eq("customer_phone", chatId).maybeSingle();

  if (!booking) {
    const kb = inlineKeyboard([[{ text: "📋 حجوزاتي", callback_data: "my_bookings" }]]);
    await sendAndSave(supabase, convId, chatId, `❌ لم يتم العثور على حجز #${bookingNum}.`, token, kb);
    return true;
  }

  if (booking.status === "cancelled" || booking.status === "completed") {
    await sendAndSave(supabase, convId, chatId, `⚠️ الحجز #${bookingNum} ${booking.status === "cancelled" ? "ملغي مسبقاً" : "مكتمل"}.`, token);
    return true;
  }

  updateSession(supabase, chatId, { current_step: "confirm_cancel", selected_date: String(bookingNum) });

  const keyboard = inlineKeyboard([
    [{ text: "✅ نعم، إلغاء", callback_data: "cancel_yes" }, { text: "❌ لا، تراجع", callback_data: "cancel_no" }],
  ]);
  await sendAndSave(supabase, convId, chatId, `⚠️ هل تريد إلغاء الحجز #${bookingNum} في ${booking.stations?.name}?`, token, keyboard);
  return true;
}

async function handleConfirmCancel(supabase: any, chatId: string, convId: string, token: string, settings: Record<string, string>, session: any, input: string) {
  const bookingNum = parseInt(session.selected_date);
  const backKb = inlineKeyboard([[{ text: "🔙 القائمة الرئيسية", callback_data: "go_back" }]]);
  if (input === "نعم" || input === "اي" || input === "أي" || input === "cancel_yes") {
    supabase.from("bookings").update({ status: "cancelled" }).eq("booking_number", bookingNum).eq("customer_phone", chatId).then(() => {}).catch(() => {});
    const cancelTemplate = settings.BOT_CANCELLATION_MESSAGE || "تم إلغاء حجزك رقم #{booking_number}. نتمنى خدمتك مستقبلاً!";
    const cancelMsg = replaceTemplateVars(cancelTemplate, { booking_number: String(bookingNum) });
    await sendAndSave(supabase, convId, chatId, cancelMsg, token, backKb);
  } else {
    await sendAndSave(supabase, convId, chatId, "تم التراجع عن الإلغاء. ✅", token, backKb);
  }
  updateSession(supabase, chatId, { current_step: "idle", selected_station_id: null, selected_service_id: null, selected_date: null });
  return true;
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const bodyText = await req.text();

  // Process in background
  const processing = (async () => {
    try {
      const settings = await getSettings(supabase);
      const token = settings.TELEGRAM_BOT_TOKEN;
      if (!token) { console.error("TELEGRAM_BOT_TOKEN not set"); return; }

      let body: any;
      try { body = JSON.parse(bodyText); } catch { return; }

      // Handle callback_query (inline button presses)
      if (body.callback_query) {
        const cb = body.callback_query;
        const chatId = String(cb.message?.chat?.id || cb.from?.id);
        const data = cb.data || "";
        const contactName = [cb.from?.first_name, cb.from?.last_name].filter(Boolean).join(" ") || chatId;

        // Answer callback to remove loading state
        fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: cb.id }),
        }).catch(() => {});

        // Parse callback data to extract number or action
        let input = data;
        const stationMatch = data.match(/^station_(\d+)$/);
        const serviceMatch = data.match(/^service_(\d+)$/);
        const dayMatch = data.match(/^day_(\d+)$/);
        const timeMatch = data.match(/^time_(\d+)$/);
        const cancelBookingMatch = data.match(/^cancel_(\d+)$/);
        if (stationMatch) input = stationMatch[1];
        else if (serviceMatch) input = serviceMatch[1];
        else if (dayMatch) input = dayMatch[1];
        else if (timeMatch) input = timeMatch[1];
        else if (data === "cancel_yes") input = "نعم";
        else if (data === "cancel_no") input = "لا";
        else if (data === "my_bookings") input = "حجوزاتي";
        else if (data === "go_back") input = "0";
        else if (data === "noop") { return; }
        else if (cancelBookingMatch) input = `إلغاء #${cancelBookingMatch[1]}`;
        // sid_*, stations_page_*, search_station, book_nearest, near_station_N are passed as-is

        // Find or create conversation
        const now = new Date().toISOString();
        const { data: existingConv } = await supabase.from("conversations").select("id").eq("customer_phone", chatId).eq("status", "open").maybeSingle();
        let convId: string;
        if (existingConv) {
          convId = existingConv.id;
          supabase.from("conversations").update({ last_message_at: now, customer_name: contactName }).eq("id", convId).then(() => {}).catch(() => {});
        } else {
          const { data: newConv } = await supabase.from("conversations")
            .insert({ customer_phone: chatId, customer_name: contactName, status: "open", last_message_at: now, platform: "telegram" })
            .select("id").single();
          if (!newConv) return;
          convId = newConv.id;
        }

        const owner = await checkIfOwner(supabase, chatId);
        if (owner) {
          await handleOwnerLogic(supabase, chatId, input, convId, token, settings, owner);
        } else {
          // Auto-register bot customer (fire-and-forget)
          upsertBotCustomer(supabase, chatId, contactName !== chatId ? contactName : null, "telegram");
          await handleCustomerLogic(supabase, chatId, input, convId, token, settings);
        }
        return;
      }

      // Handle regular messages
      const message = body.message;
      if (!message) return;

      const chatId = String(message.chat.id);
      const contactName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ") || chatId;

      let content = "";
      let locationData: { latitude: number; longitude: number } | undefined;

      if (message.text) {
        content = message.text;
      } else if (message.location) {
        content = `📍 موقع: ${message.location.latitude}, ${message.location.longitude}`;
        locationData = { latitude: message.location.latitude, longitude: message.location.longitude };
      } else if (message.photo) {
        content = message.caption || "📷 صورة";
      } else if (message.voice || message.audio) {
        content = "🎵 رسالة صوتية";
      } else if (message.video) {
        content = message.caption || "🎥 فيديو";
      } else if (message.document) {
        content = message.document?.file_name || "📄 مستند";
      } else if (message.sticker) {
        content = "😊 ملصق";
      } else {
        content = "رسالة غير مدعومة";
      }

      // Find or create conversation
      const now = new Date().toISOString();
      const { data: existingConv } = await supabase.from("conversations").select("id").eq("customer_phone", chatId).eq("status", "open").maybeSingle();
      let convId: string;
      if (existingConv) {
        convId = existingConv.id;
        supabase.from("conversations").update({ last_message_at: now, customer_name: contactName }).eq("id", convId).then(() => {}).catch(() => {});
      } else {
        const { data: newConv } = await supabase.from("conversations")
          .insert({ customer_phone: chatId, customer_name: contactName, status: "open", last_message_at: now, platform: "telegram" })
          .select("id").single();
        if (!newConv) return;
        convId = newConv.id;
      }

      // Save inbound message (fire-and-forget)
      supabase.from("messages").insert({
        conversation_id: convId, direction: "inbound", content,
        message_type: message.location ? "location" : "text",
        whatsapp_message_id: String(message.message_id),
        status: "delivered", platform: "telegram",
      }).then(() => {}).catch(() => {});

      // Route: Owner or Customer?
      const owner = await checkIfOwner(supabase, chatId);

      if (owner) {
        await handleOwnerLogic(supabase, chatId, content, convId, token, settings, owner);
      } else {
        // Auto-register bot customer (fire-and-forget)
        upsertBotCustomer(supabase, chatId, contactName !== chatId ? contactName : null, "telegram");
        await handleCustomerLogic(supabase, chatId, content, convId, token, settings, locationData);
      }

    } catch (error) {
      console.error("Telegram webhook error:", error);
    }
  })();

  try {
    // @ts-ignore
    EdgeRuntime.waitUntil(processing);
  } catch {
    await processing;
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
