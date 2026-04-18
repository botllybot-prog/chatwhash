import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ==================== HELPERS ====================

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/^\+/, "").replace(/\s+/g, "");
  // Iraqi local → international: 07XXXXXXXXX (11 digits) → 9647XXXXXXXXX
  if (/^07\d{9}$/.test(cleaned)) return "964" + cleaned.substring(1);
  return cleaned;
}

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
    selected_station_id: null, selected_service_id: null, selected_date: null,
    selected_time: null, vehicle_details: null, pending_booking_id: null,
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

function to12Hour(time24: string): string {
  const parts = time24.split(":");
  const h = parseInt(parts[0]);
  const m = parseInt(parts[1]);
  const period = h < 12 ? "صباحاً" : "مساءً";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateMinutes(distKm: number): number {
  // ~30 km/h average city speed, minimum 2 minutes
  return Math.max(2, Math.round(distKm / 30 * 60));
}

function replaceTemplateVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

// Returns station_ids of stations whose owner is currently suspended
async function getSuspendedStationIds(supabase: any): Promise<string[]> {
  const { data } = await supabase.from("station_owners")
    .select("station_id").eq("is_active", false);
  return (data || []).map((r: any) => r.station_id).filter(Boolean);
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

function notifyAdmin(supabase: any, settings: Record<string, string>, message: string, bookingId?: string) {
  const adminPhone = settings.ADMIN_WHATSAPP_PHONE;
  // Fire-and-forget: send WhatsApp + insert DB notification
  (async () => {
    try {
      // Insert into notifications table for bell icon
      await supabase.from("notifications").insert({
        title: "حجز جديد",
        body: message,
        type: "new_booking",
        is_read: false,
        reference_id: bookingId || null,
        user_id: null,
      });
    } catch (e) { console.error("DB notify error:", e); }

    if (!adminPhone) return;
    try {
      const convId = await getOrCreateConvForPhone(supabase, adminPhone, "المسؤول");
      await sendWhatsAppMessage(adminPhone, message, settings);
      if (convId) saveBotMessage(supabase, convId, message, null);
    } catch (e) { console.error("Admin notify error:", e); }
  })();
}

// ==================== CHECK IF ADMIN ====================

function checkIfAdmin(phone: string, settings: Record<string, string>): boolean {
  const adminPhone = settings.ADMIN_WHATSAPP_PHONE;
  if (!adminPhone) return false;
  const normalizedAdmin = normalizePhone(adminPhone.trim());
  // Build both formats of admin phone to compare
  const adminAlts = [normalizedAdmin];
  if (/^9647\d{9}$/.test(normalizedAdmin)) adminAlts.push("0" + normalizedAdmin.substring(3));
  else if (/^07\d{9}$/.test(normalizedAdmin)) adminAlts.push("964" + normalizedAdmin.substring(1));
  return adminAlts.includes(phone);
}

// ==================== CHECK IF OWNER ====================

async function checkIfOwner(supabase: any, phone: string) {
  // Try exact match first, then alternative format (local ↔ international)
  const alts = [phone];
  if (/^9647\d{9}$/.test(phone)) alts.push("0" + phone.substring(3)); // intl → local: 9647XXXXXXXXX → 07XXXXXXXXX
  else if (/^07\d{9}$/.test(phone)) alts.push("964" + phone.substring(1)); // local → intl: 07XXXXXXXXX → 9647XXXXXXXXX

  for (const p of alts) {
    const { data } = await supabase.from("station_owners")
      .select("id, owner_name, station_id, is_active, outstanding_debt, stations(name)")
      .eq("owner_phone", p).maybeSingle();
    if (data) return data;
  }
  return null;
}

// ==================== CONFIRM BOOKING & NOTIFY CUSTOMER ====================

async function confirmBookingAndNotifyCustomer(
  supabase: any, ownerPhone: string, ownerConvId: string,
  settings: Record<string, string>, owner: any,
  bookingId: string, offer: string | null, note: string | null
) {
  // Confirm booking in DB
  const updateData: any = { status: "confirmed" };
  if (offer) updateData.owner_offer = offer;
  if (note) updateData.owner_note = note;
  await supabase.from("bookings").update(updateData).eq("id", bookingId);

  // ── Competitive punishment: cancel any OTHER pending bookings for this customer ──
  // Use customer_phone from booking record
  const { data: confirmedBk } = await supabase.from("bookings")
    .select("customer_phone")
    .eq("id", bookingId).single();
  if (confirmedBk?.customer_phone) {
    const { data: competingBks } = await supabase.from("bookings")
      .select("id, booking_number, station_id, stations(name)")
      .eq("customer_phone", confirmedBk.customer_phone)
      .eq("status", "pending")
      .neq("id", bookingId);
    for (const cb of competingBks || []) {
      await supabase.from("bookings").update({ status: "cancelled" }).eq("id", cb.id);
      // Notify the losing station owner
      const { data: losingOwner } = await supabase.from("station_owners")
        .select("owner_phone")
        .eq("station_id", cb.station_id).maybeSingle();
      if (losingOwner?.owner_phone) {
        const losingPhone = normalizePhone(losingOwner.owner_phone);
        const losingConvId = await getOrCreateConvForPhone(supabase, losingPhone);
        if (losingConvId) {
          const stName = (cb.stations as any)?.name || "محطتك";
          const alertMsg = `⚠️ تم إلغاء الطلب رقم #${cb.booking_number} في ${stName}.\nلقد قام الزبون بالحجز في مغسلة أخرى بسبب التأخر في الرد.`;
          await sendAndSave(supabase, losingConvId, losingPhone, alertMsg, settings);
          updateSession(supabase, losingPhone, { current_step: "owner_idle", pending_booking_id: null });
        }
      }
    }
  }

  // Fetch full booking details
  const { data: booking } = await supabase.from("bookings")
    .select("booking_number, customer_phone, booking_date, booking_time, owner_offer, owner_note, stations(name, address, latitude, longitude), services(name, price)")
    .eq("id", bookingId).single();

  // Notify owner immediately
  const ownerConfirmMsg = `✅ تم تأكيد الحجز #${booking?.booking_number || ""} وإرسال التفاصيل للعميل.`;
  await sendAndSave(supabase, ownerConvId, ownerPhone, ownerConfirmMsg, settings);
  updateSession(supabase, ownerPhone, { current_step: "owner_idle", pending_booking_id: null });
  await showOwnerMenu(supabase, ownerPhone, ownerConvId, settings, owner);

  // Send full confirmation to customer
  if (booking) {
    const custConvId = await getOrCreateConvForPhone(supabase, booking.customer_phone);
    if (custConvId) {
      const timeLabel = booking.booking_time ? to12Hour(booking.booking_time.substring(0, 5)) : "-";
      const dateFormatted = new Date(booking.booking_date).toLocaleDateString("ar-IQ", { calendar: "gregory", weekday: "long", year: "numeric", month: "long", day: "numeric" });

      let custMsg = `✅ تم تأكيد حجزك!\n\n📍 المحطة: ${(booking.stations as any)?.name || ""}\n🔧 الخدمة: ${booking.services?.name || ""}\n💰 السعر: ${booking.services?.price || ""} د.ع\n📅 التاريخ: ${dateFormatted}\n🕐 الوقت: ${timeLabel}\n📋 رقم الحجز: #${booking.booking_number}`;
      const finalOffer = offer || booking.owner_offer;
      const finalNote = note || booking.owner_note;
      if (finalOffer) custMsg += `\n\n🎁 عرض خاص: ${finalOffer}`;
      if (finalNote) custMsg += `\n📝 ملاحظة: ${finalNote}`;
      custMsg += "\n\nنتمنى لك تجربة رائعة! 🚗✨";

      await sendAndSave(supabase, custConvId, booking.customer_phone, custMsg, settings);

      // Google Maps link
      const stationData = booking.stations as any;
      const lat = stationData?.latitude ? parseFloat(stationData.latitude) : null;
      const lng = stationData?.longitude ? parseFloat(stationData.longitude) : null;
      const stationAddress = stationData?.address || "";
      if (lat && lng) {
        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        const locationMsg = `📍 موقع المغسلة على الخريطة:\n${stationAddress ? stationAddress + "\n" : ""}${mapsUrl}`;
        await sendAndSave(supabase, custConvId, booking.customer_phone, locationMsg, settings);
      } else if (stationAddress) {
        const encoded = encodeURIComponent(stationAddress);
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
        const locationMsg = `📍 موقع المغسلة:\n${stationAddress}\n${mapsUrl}`;
        await sendAndSave(supabase, custConvId, booking.customer_phone, locationMsg, settings);
      }

      // Follow-up buttons for customer
      const followWaId = await sendWhatsAppInteractive(booking.customer_phone, "ماذا تريد أن تفعل؟", [
        { id: "btn_bookings", title: "📋 حجوزاتي" },
        { id: "btn_menu", title: "🏠 القائمة الرئيسية" },
      ], settings);
      saveBotMessage(supabase, custConvId, "أزرار بعد التأكيد", followWaId);
      updateSession(supabase, booking.customer_phone, { current_step: "idle" });
    }
  }
}

// ==================== OWNER BOT LOGIC ====================

async function handleOwnerLogic(
  supabase: any, phone: string, content: string, convId: string, settings: Record<string, string>, owner: any
): Promise<boolean> {
  // ── Check if owner account is suspended ──────────────────────────
  if (owner.is_active === false) {
    const session = await getOrCreateSession(supabase, phone);
    const step = session?.current_step || "idle";
    const input = content.trim();
    const debt = (owner.outstanding_debt as number) || 0;
    const stationName = owner.stations?.name || "مغسلتك";

    // ── Handle invoice step: owner selected a payment method ──────
    if (input.startsWith("pay_method_")) {
      const method = input === "pay_method_zain" ? "zain" : input === "pay_method_super" ? "super" : "nas";
      const methodLabel = method === "zain" ? "💚 زين كاش" : method === "super" ? "🔵 سوبر كي" : "🟠 ناس وولت";
      const accountNum =
        method === "zain" ? settings.PAYMENT_ZAIN_CASH :
        method === "super" ? settings.PAYMENT_SUPER_KEY :
        settings.PAYMENT_NAS_WALLET;

      const invoiceMsg =
        `🧾 فاتورة تسديد 🧾\n\n` +
        `المغسلة: ${stationName}\n` +
        `المبلغ المستحق: ${debt.toLocaleString("ar-IQ")} دينار عراقي\n` +
        `طريقة الدفع: ${methodLabel}\n` +
        `رقم الحساب: ${accountNum || "تواصل مع الإدارة"}\n\n` +
        `بعد إتمام التحويل، اضغط "تم الدفع" لإبلاغ الإدارة.`;

      const waId = await sendWhatsAppInteractive(phone, invoiceMsg, [
        { id: "payment_done", title: "✅ تم الدفع" },
        { id: "payment_delay", title: "⏳ تأجيل الدفع" },
      ], settings);
      saveBotMessage(supabase, convId, invoiceMsg, waId);
      updateSession(supabase, phone, { current_step: "owner_payment_confirm" });
      return true;
    }

    // ── Handle payment confirmation ───────────────────────────────
    if (step === "owner_payment_confirm" || input === "payment_done" || input === "payment_delay") {
      if (input === "payment_done") {
        const ownerAckMsg =
          `✅ تم إرسال طلبك للإدارة.\n\n` +
          `سيتم التحقق من الحوالة وإعادة تفعيل حسابك يدوياً فور التأكيد.\n` +
          `يمكنك إرسال صورة وصل الدفع للإدارة للتسريع.`;
        await sendAndSave(supabase, convId, phone, ownerAckMsg, settings);

        // Notify admin
        const adminMsg =
          `🔔 إشعار دفع من مغسلة\n\n` +
          `المغسلة: ${stationName}\n` +
          `المالك: ${owner.owner_name || "غير معروف"}\n` +
          `الهاتف: ${phone}\n` +
          `المبلغ المطالب بدفعه: ${debt.toLocaleString("ar-IQ")} دينار عراقي\n\n` +
          `⚠️ يرجى التحقق من الحوالة ثم إعادة تفعيل الحساب يدوياً من لوحة الإدارة.`;
        await notifyAdmin(supabase, settings, adminMsg);

        updateSession(supabase, phone, { current_step: "owner_idle" });
        return true;
      }
      if (input === "payment_delay") {
        await sendAndSave(supabase, convId, phone,
          `حسناً، سيبقى حسابك موقوفاً حتى يتم التسديد. شكراً لتفهمك.`,
          settings
        );
        updateSession(supabase, phone, { current_step: "owner_idle" });
        return true;
      }
    }

    // ── Default: show suspension notice with payment method buttons ──
    const suspendMsg =
      `⚠️ إشعار إداري مهم ⚠️\n\n` +
      `عذراً، تم إيقاف حساب ${stationName} في النظام.\n` +
      `السبب: وجود ذمة مالية غير مسددة.\n` +
      `المبلغ المستحق: ${debt.toLocaleString("ar-IQ")} دينار عراقي.\n\n` +
      `يرجى تسديد المبلغ للإدارة لإعادة تفعيل حسابك واستقبال الحجوزات.\n\n` +
      `اختر طريقة الدفع:`;

    const waId = await sendWhatsAppInteractive(phone, suspendMsg, [
      { id: "pay_method_zain", title: "💚 زين كاش" },
      { id: "pay_method_super", title: "🔵 سوبر كي" },
      { id: "pay_method_nas", title: "🟠 ناس وولت" },
    ], settings);
    saveBotMessage(supabase, convId, suspendMsg, waId);
    updateSession(supabase, phone, { current_step: "owner_payment_method" });
    return true;
  }

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
  if (step === "idle" || step === "owner_idle" || input === "owner_refresh") {
    return await showOwnerMenu(supabase, phone, convId, settings, owner);
  }

  // ── Global: change_time_{bookingId} — works at ANY session step ──────────
  // Button payload embeds bookingId so no session state is required.
  if (input.startsWith("change_time_")) {
    const ctBookingId = input.replace("change_time_", "");
    const { data: ctBk } = await supabase.from("bookings")
      .select("id, booking_number, booking_date, stations(scheduling_type, working_hours_start, working_hours_end, slot_duration_minutes, name)")
      .eq("id", ctBookingId).eq("station_id", owner.station_id).maybeSingle();
    if (!ctBk) return await showOwnerMenu(supabase, phone, convId, settings, owner);
    const ctSt = ctBk.stations as any;
    const ctNow = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const ctToday = ctNow.toISOString().split("T")[0];
    const ctAllSlots = generateTimeSlots(
      ctSt?.working_hours_start || "08:00",
      ctSt?.working_hours_end   || "20:00",
      ctSt?.slot_duration_minutes || 30
    );
    const { data: ctBooked } = await supabase.from("bookings").select("booking_time")
      .eq("station_id", owner.station_id).eq("booking_date", ctToday)
      .in("status", ["pending", "confirmed", "pending_customer_approval"])
      .neq("id", ctBookingId);
    const ctBookedSet = new Set((ctBooked || []).map((b: any) => b.booking_time?.substring(0, 5)));
    const ctAvailable = ctAllSlots.filter((s: string) => !ctBookedSet.has(s));
    if (ctAvailable.length === 0) {
      const noSlotWaId = await sendWhatsAppInteractive(phone,
        `⚠️ لا توجد مواعيد متاحة اليوم في ${ctSt?.name || "المحطة"}. هل تود رفض الحجز؟`,
        [{ id: "approve_no", title: "❌ رفض الحجز" }, { id: "approve_yes", title: "✅ تأكيد الحجز" }], settings);
      saveBotMessage(supabase, convId, "لا مواعيد متاحة", noSlotWaId);
      updateSession(supabase, phone, { current_step: "owner_approve_reject", pending_booking_id: ctBookingId });
      return true;
    }
    const ctRows = ctAvailable.slice(0, 9).map((s: string) => ({ id: `propose_time_${s}`, title: to12Hour(s) }));
    ctRows.push({ id: "propose_time_back", title: "🔙 رجوع" });
    const ctMsg = `📅 اختر الوقت البديل للحجز رقم #${ctBk.booking_number}:`;
    const ctWaId = await sendWhatsAppList(phone, ctMsg, "اختر وقتاً", [{ title: "الأوقات المتاحة", rows: ctRows }], settings);
    saveBotMessage(supabase, convId, ctMsg, ctWaId);
    updateSession(supabase, phone, { current_step: "owner_propose_time", pending_booking_id: ctBookingId, selected_date: ctToday });
    return true;
  }

  // Owner selects a pending booking from list (ID: pending_UUID)
  if (step === "owner_view_pending" || input.startsWith("pending_")) {
    const pendingMatch = input.match(/^pending_([a-f0-9-]+)$/i);
    if (!pendingMatch) {
      return await showOwnerMenu(supabase, phone, convId, settings, owner);
    }
    const bookingId = pendingMatch[1];
    const { data: b } = await supabase.from("bookings")
      .select("id, booking_number, customer_name, customer_phone, booking_date, booking_time, services(name, price)")
      .eq("id", bookingId).eq("station_id", owner.station_id).eq("status", "pending").maybeSingle();

    if (!b) {
      return await showOwnerMenu(supabase, phone, convId, settings, owner);
    }

    updateSession(supabase, phone, { current_step: "owner_approve_reject", pending_booking_id: b.id });
    const detailMsg = `📋 تفاصيل الحجز #${b.booking_number}:\n\n📱 العميل: ${b.customer_name || b.customer_phone}\n🧽 الخدمة: ${b.services?.name} - ${b.services?.price} د.ع\n📅 التاريخ: ${b.booking_date}${b.booking_time ? "\n⏰ الوقت: " + to12Hour(b.booking_time.substring(0, 5)) : ""}\n\nهل توافق على الحجز؟`;
    const waId = await sendWhatsAppInteractive(phone, detailMsg, [
      { id: "approve_yes", title: "✅ موافق" },
      { id: "approve_no", title: "❌ غير موافق" },
      { id: `change_time_${b.id}`, title: "📅 تعديل الموعد" },
    ], settings);
    saveBotMessage(supabase, convId, detailMsg, waId);
    return true;
  }

  // Owner approving/rejecting a booking
  if (step === "owner_approve_reject") {
    const bookingId = session.pending_booking_id;
    if (!bookingId) {
      updateSession(supabase, phone, { current_step: "owner_idle" });
      return await showOwnerMenu(supabase, phone, convId, settings, owner);
    }

    // ── اقتراح وقت بديل: fallback للأزرار القديمة (approve_reschedule بدون bookingId) ──
    if (input === "approve_reschedule") {
      // Redirect to global change_time_ handler using the session's bookingId
      return await handleOwnerLogic(supabase, phone, `change_time_${bookingId}`, convId, settings, owner);
    }

    // ── تأكيد ──
    if (input === "تأكيد" || input === "approve_yes" || input === "موافق") {
      // Ask for optional offer/note before sending confirmation
      const waId = await sendWhatsAppInteractive(phone, "✅ ممتاز!\n\nهل تريد إضافة عرض أو ملاحظة للعميل؟", [
        { id: "owner_offer_skip", title: "⏭️ لا، أرسل التأكيد" },
        { id: "owner_offer_add", title: "💬 إضافة عرض/ملاحظة" },
      ], settings);
      saveBotMessage(supabase, convId, "سؤال عن العرض", waId);
      updateSession(supabase, phone, { current_step: "owner_offer" });
      return true;
    }

    // ── رفض ──
    if (input === "رفض" || input === "approve_no" || input === "غير موافق") {
      const [, bookingResult] = await Promise.all([
        supabase.from("bookings").update({ status: "cancelled" }).eq("id", bookingId),
        supabase.from("bookings").select("customer_phone, booking_number, booking_date, booking_time, stations(name), services(name)").eq("id", bookingId).single(),
      ]);
      const booking = bookingResult.data;

      if (booking) {
        const custConvId = await getOrCreateConvForPhone(supabase, booking.customer_phone);
        if (custConvId) {
          const custMsg = `❌ تم رفض الحجز\n\n📋 رقم الحجز: #${booking.booking_number}\n📍 المحطة: ${booking.stations?.name || ""}\n🔧 الخدمة: ${booking.services?.name || ""}\n\nعذراً على الإزعاج. يمكنك الحجز في وقت آخر.`;
          const custWaId = await sendWhatsAppInteractive(booking.customer_phone, custMsg, [
            { id: "btn_menu", title: "🔄 حجز موعد جديد" },
          ], settings);
          saveBotMessage(supabase, custConvId, custMsg, custWaId);
          updateSession(supabase, booking.customer_phone, { current_step: "idle" });
        }
        // Notify owner of action
        const ownerAckMsg = `❌ تم رفض الحجز #${booking.booking_number} وإبلاغ العميل.`;
        await sendAndSave(supabase, convId, phone, ownerAckMsg, settings);
      }

      updateSession(supabase, phone, { current_step: "owner_idle", pending_booking_id: null });
      await showOwnerMenu(supabase, phone, convId, settings, owner);
      return true;
    }

    // Fallback: أعد إرسال الأزرار
    const fallbackMsg = "يرجى اختيار أحد الخيارات:";
    const fbWaId = await sendWhatsAppInteractive(phone, fallbackMsg, [
      { id: "approve_yes", title: "✅ تأكيد" },
      { id: "approve_no", title: "❌ رفض" },
      { id: `change_time_${bookingId}`, title: "📅 تغيير الموعد" },
    ], settings);
    saveBotMessage(supabase, convId, fallbackMsg, fbWaId);
    return true;
  }

  // Owner offer step — skip or type offer/note
  if (step === "owner_offer") {
    const bookingId = session.pending_booking_id;
    if (input === "owner_offer_skip") {
      // No offer — confirm directly
      await confirmBookingAndNotifyCustomer(supabase, phone, convId, settings, owner, bookingId, null, null);
      return true;
    }
    if (input === "owner_offer_add") {
      await sendAndSave(supabase, convId, phone, "✏️ اكتب العرض أو الملاحظة للعميل:", settings);
      return true;
    }
    // Typed offer/note text
    await confirmBookingAndNotifyCustomer(supabase, phone, convId, settings, owner, bookingId, null, input);
    return true;
  }

  // ── اقتراح وقت بديل: المالك يختار الوقت ──
  if (step === "owner_propose_time") {
    const bookingId = session.pending_booking_id;
    if (!bookingId) {
      updateSession(supabase, phone, { current_step: "owner_idle" });
      return await showOwnerMenu(supabase, phone, convId, settings, owner);
    }
    if (input === "propose_time_back") {
      // Go back to approve/reject buttons for this booking
      const { data: bk } = await supabase.from("bookings")
        .select("booking_number, customer_name, customer_phone, booking_date, booking_time, services(name, price)")
        .eq("id", bookingId).single();
      if (bk) {
        const detailMsg = `📋 تفاصيل الحجز #${bk.booking_number}:\n\n📱 العميل: ${bk.customer_name || bk.customer_phone}\n🧽 الخدمة: ${bk.services?.name} - ${bk.services?.price} د.ع\n📅 التاريخ: ${bk.booking_date}${bk.booking_time ? "\n⏰ الوقت: " + to12Hour(bk.booking_time.substring(0, 5)) : ""}\n\nاختر أحد الخيارات:`;
        const waId = await sendWhatsAppInteractive(phone, detailMsg, [
          { id: "approve_yes", title: "✅ تأكيد" },
          { id: "approve_no", title: "❌ رفض" },
          { id: `change_time_${bookingId}`, title: "📅 اقتراح وقت بديل" },
        ], settings);
        saveBotMessage(supabase, convId, detailMsg, waId);
      }
      updateSession(supabase, phone, { current_step: "owner_approve_reject" });
      return true;
    }
    const proposeMatch = input.match(/^propose_time_(\d{2}:\d{2})$/);
    if (!proposeMatch) {
      // Resend available slots
      updateSession(supabase, phone, { current_step: "owner_propose_time" });
      const waId = await sendWhatsAppInteractive(phone, "يرجى اختيار وقت من القائمة.", [{ id: "propose_time_back", title: "🔙 رجوع" }], settings);
      saveBotMessage(supabase, convId, "خطأ في الاختيار", waId);
      return true;
    }
    const proposedTime = proposeMatch[1];
    const proposedDate = session.selected_date || new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split("T")[0];
    // Update booking: proposed_time, proposed_date, status = pending_customer_approval
    await supabase.from("bookings").update({
      proposed_time: proposedTime,
      proposed_date: proposedDate,
      status: "pending_customer_approval" as any,
    }).eq("id", bookingId);
    // Fetch booking details to notify customer
    const { data: proposedBk } = await supabase.from("bookings")
      .select("booking_number, customer_phone, stations(name), services(name, price)")
      .eq("id", bookingId).single();

    let customerNotified = false;
    if (proposedBk) {
      const custPhone = normalizePhone(proposedBk.customer_phone);
      const custConvId = await getOrCreateConvForPhone(supabase, custPhone);
      if (custConvId) {
        const stationName = (proposedBk.stations as any)?.name || "";
        const custMsg =
          `⚠️ تحديث بخصوص حجزك ⚠️\n\n` +
          `عذراً، المغسلة مزدحمة في الوقت المطلوب.\n` +
          `لقد اقترحت إدارة مغسلة ${stationName} موعداً بديلاً في الساعة (${to12Hour(proposedTime)}).\n\n` +
          `هل توافق؟`;
        const custWaId = await sendWhatsAppInteractive(custPhone, custMsg, [
          { id: "new_time_accept", title: "✅ موافق على الوقت الجديد" },
          { id: "new_time_reject", title: "🔍 رفض والبحث عن مغسلة أخرى" },
        ], settings);
        saveBotMessage(supabase, custConvId, custMsg, custWaId);
        updateSession(supabase, custPhone, {
          current_step: "awaiting_new_time_approval",
          pending_booking_id: bookingId,
        });
        customerNotified = !!custWaId;
      }
    }

    // Notify owner ONLY after customer push completes
    const ownerAckMsg = customerNotified
      ? `✅ تم إرسال الوقت البديل للعميل بنجاح. نحن الآن بانتظار موافقته.`
      : `⚠️ تعذّر إرسال الإشعار للعميل. تحقق من رقم هاتفه وحاول مجدداً.`;
    await sendAndSave(supabase, convId, phone, ownerAckMsg, settings);
    updateSession(supabase, phone, { current_step: "owner_idle", pending_booking_id: null, selected_date: null });
    await showOwnerMenu(supabase, phone, convId, settings, owner);
    return true;
  }

  // Default: show menu
  return await showOwnerMenu(supabase, phone, convId, settings, owner);
}

async function showOwnerMenu(supabase: any, phone: string, convId: string, settings: Record<string, string>, owner: any) {
  const { data: pendingBookings } = await supabase.from("bookings")
    .select("id, booking_number, customer_name, customer_phone, booking_date, booking_time, services(name, price)")
    .eq("station_id", owner.station_id).eq("status", "pending").order("created_at");

  const stationName = owner.stations?.name || "محطتك";

  if (!pendingBookings || pendingBookings.length === 0) {
    const waId = await sendWhatsAppInteractive(phone,
      `مرحباً ${owner.owner_name} 👋\nلوحة إدارة ${stationName}\n\n✅ لا توجد حجوزات معلقة حالياً.`,
      [{ id: "owner_refresh", title: "🔄 تحديث" }], settings);
    saveBotMessage(supabase, convId, `لوحة ${stationName} - لا توجد حجوزات`, waId);
    updateSession(supabase, phone, { current_step: "owner_idle", selected_station_id: owner.station_id });
    return true;
  }

  const rows = pendingBookings.slice(0, 10).map((b: any) => ({
    id: `pending_${b.id}`,
    title: `#${b.booking_number} - ${(b.customer_name || b.customer_phone).substring(0, 16)}`.substring(0, 24),
    description: `${b.services?.name} | ${b.booking_date}${b.booking_time ? " " + to12Hour(b.booking_time.substring(0, 5)) : ""}`.substring(0, 72),
  }));

  const body = `مرحباً ${owner.owner_name} 👋\nلوحة إدارة ${stationName}\n\n📋 لديك ${pendingBookings.length} حجز معلق\nاختر حجزاً للموافقة أو الرفض:`;
  const waId = await sendWhatsAppList(phone, body, "اعرض الحجوزات", [{ title: "الحجوزات المعلقة", rows }], settings);
  saveBotMessage(supabase, convId, body, waId);
  updateSession(supabase, phone, { current_step: "owner_view_pending", selected_station_id: owner.station_id });
  return true;
}

// ==================== ADMIN BOT LOGIC ====================

async function handleAdminLogic(
  supabase: any, phone: string, input: string, convId: string, settings: Record<string, string>
): Promise<boolean> {
  // Iraq timezone: UTC+3
  const nowIraq = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const todayStr = nowIraq.toISOString().split("T")[0]; // YYYY-MM-DD

  // Start of current week (Saturday = first day in Iraq, use Sunday for simplicity)
  const dayOfWeek = nowIraq.getUTCDay(); // 0=Sun
  const weekStartMs = nowIraq.getTime() - dayOfWeek * 24 * 60 * 60 * 1000;
  const weekStartStr = new Date(weekStartMs).toISOString().split("T")[0];

  // Start of current month
  const monthStartStr = `${nowIraq.getUTCFullYear()}-${String(nowIraq.getUTCMonth() + 1).padStart(2, "0")}-01`;

  // ── حجوزات اليوم ──
  if (input === "admin_bookings_today") {
    const { data: bookings } = await supabase.from("bookings")
      .select("booking_number, customer_name, customer_phone, status, booking_time, stations(name), services(name, price)")
      .eq("booking_date", todayStr).order("booking_time");

    if (!bookings || bookings.length === 0) {
      const waId = await sendWhatsAppInteractive(phone,
        `📊 حجوزات اليوم (${todayStr})\n\nلا توجد حجوزات اليوم.`,
        [{ id: "admin_menu", title: "🔙 القائمة" }], settings);
      saveBotMessage(supabase, convId, "لا توجد حجوزات اليوم", waId);
      return true;
    }

    const pending = bookings.filter((b: any) => b.status === "pending").length;
    const confirmed = bookings.filter((b: any) => b.status === "confirmed").length;
    const cancelled = bookings.filter((b: any) => b.status === "cancelled").length;

    let msg = `📊 حجوزات اليوم (${todayStr})\n\nإجمالي: ${bookings.length} حجز\n⏳ انتظار: ${pending}   ✅ مؤكد: ${confirmed}   ❌ ملغى: ${cancelled}\n\n`;
    const slice = bookings.slice(0, 10);
    for (const b of slice) {
      const timeLabel = b.booking_time ? to12Hour(b.booking_time.substring(0, 5)) : "";
      const icon = b.status === "confirmed" ? "✅" : b.status === "cancelled" ? "❌" : "⏳";
      msg += `${icon} #${b.booking_number} | ${b.stations?.name || ""}\n   🧽 ${b.services?.name || ""}${timeLabel ? " | ⏰ " + timeLabel : ""}\n   👤 ${b.customer_name || b.customer_phone}\n`;
    }
    if (bookings.length > 10) msg += `\n... و${bookings.length - 10} حجوزات أخرى`;

    const waId = await sendWhatsAppInteractive(phone, msg,
      [{ id: "admin_menu", title: "🔙 القائمة" }], settings);
    saveBotMessage(supabase, convId, msg, waId);
    return true;
  }

  // ── مبيعات اليوم ──
  if (input === "admin_sales_today") {
    const { data: bookings } = await supabase.from("bookings")
      .select("services(price)").eq("booking_date", todayStr).in("status", ["confirmed"]);
    const total = (bookings || []).reduce((s: number, b: any) => s + (b.services?.price || 0), 0);
    const count = bookings?.length || 0;
    const msg = `💰 مبيعات اليوم (${todayStr})\n\n✅ حجوزات مؤكدة: ${count}\n💵 الإجمالي: ${total.toLocaleString("ar-IQ")} د.ع`;
    const waId = await sendWhatsAppInteractive(phone, msg, [
      { id: "admin_sales_week", title: "📈 مبيعات الأسبوع" },
      { id: "admin_menu", title: "🔙 القائمة" },
    ], settings);
    saveBotMessage(supabase, convId, msg, waId);
    return true;
  }

  // ── مبيعات الأسبوع ──
  if (input === "admin_sales_week") {
    const { data: bookings } = await supabase.from("bookings")
      .select("services(price)").gte("booking_date", weekStartStr).lte("booking_date", todayStr).in("status", ["confirmed"]);
    const total = (bookings || []).reduce((s: number, b: any) => s + (b.services?.price || 0), 0);
    const count = bookings?.length || 0;
    const msg = `📈 مبيعات الأسبوع\n(${weekStartStr} – ${todayStr})\n\n✅ حجوزات مؤكدة: ${count}\n💵 الإجمالي: ${total.toLocaleString("ar-IQ")} د.ع`;
    const waId = await sendWhatsAppInteractive(phone, msg, [
      { id: "admin_sales_month", title: "📅 مبيعات الشهر" },
      { id: "admin_menu", title: "🔙 القائمة" },
    ], settings);
    saveBotMessage(supabase, convId, msg, waId);
    return true;
  }

  // ── مبيعات الشهر ──
  if (input === "admin_sales_month") {
    const { data: bookings } = await supabase.from("bookings")
      .select("services(price)").gte("booking_date", monthStartStr).lte("booking_date", todayStr).in("status", ["confirmed"]);
    const total = (bookings || []).reduce((s: number, b: any) => s + (b.services?.price || 0), 0);
    const count = bookings?.length || 0;
    const msg = `📅 مبيعات الشهر\n(${monthStartStr} – ${todayStr})\n\n✅ حجوزات مؤكدة: ${count}\n💵 الإجمالي: ${total.toLocaleString("ar-IQ")} د.ع`;
    const waId = await sendWhatsAppInteractive(phone, msg,
      [{ id: "admin_menu", title: "🔙 القائمة" }], settings);
    saveBotMessage(supabase, convId, msg, waId);
    return true;
  }

  // ── المحطات الشغالة ──
  if (input === "admin_stations_active") {
    const { data: stations } = await supabase.from("stations")
      .select("name").eq("is_active", true).order("name");
    const count = stations?.length || 0;
    let msg = `🏪 المحطات الشغالة\n\nعدد المحطات النشطة: ${count}\n\n`;
    (stations || []).forEach((s: any) => { msg += `• ${s.name}\n`; });
    const waId = await sendWhatsAppInteractive(phone, msg,
      [{ id: "admin_menu", title: "🔙 القائمة" }], settings);
    saveBotMessage(supabase, convId, msg, waId);
    return true;
  }

  // ── Default: show admin menu ──
  const menuWaId = await sendWhatsAppList(
    phone,
    `👋 مرحباً بك في لوحة بيانات الإدارة\n📅 اليوم: ${todayStr}\n\nاختر التقرير المطلوب:`,
    "📊 عرض التقارير",
    [
      {
        title: "الحجوزات",
        rows: [
          { id: "admin_bookings_today", title: "📊 حجوزات اليوم", description: "عدد الحجوزات ومعلوماتها" },
        ],
      },
      {
        title: "المبيعات",
        rows: [
          { id: "admin_sales_today", title: "💰 مبيعات اليوم", description: "إجمالي المبيعات المؤكدة اليوم" },
          { id: "admin_sales_week", title: "📈 مبيعات الأسبوع", description: "إجمالي هذا الأسبوع" },
          { id: "admin_sales_month", title: "📅 مبيعات الشهر", description: "إجمالي هذا الشهر" },
        ],
      },
      {
        title: "المحطات",
        rows: [
          { id: "admin_stations_active", title: "🏪 المحطات الشغالة", description: "قائمة المحطات النشطة" },
        ],
      },
    ],
    settings
  );
  saveBotMessage(supabase, convId, "قائمة الإدارة", menuWaId);
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
    return await showStationsPage(supabase, phone, convId, settings, 0);
  }
  if (input === "btn_bookings") {
    return await showMyBookings(supabase, phone, convId, settings);
  }

  // Back/menu button callbacks
  if (input === "btn_menu" || input === "svc_back" || input === "time_back" || input === "day_back") {
    updateSession(supabase, phone, { current_step: "idle", selected_station_id: null, selected_service_id: null, selected_date: null, pending_booking_id: null });
    return await showCustomerWelcome(supabase, phone, convId, settings, contactName);
  }

  // Cancel booking button (from showMyBookings list — ID: cancel_N)
  const cancelBtnMatch = input.match(/^cancel_(\d+)$/);
  if (cancelBtnMatch) {
    const bookingNum = parseInt(cancelBtnMatch[1]);
    const { data: booking } = await supabase.from("bookings")
      .select("id, booking_number, status, stations(name)").eq("booking_number", bookingNum).eq("customer_phone", phone).maybeSingle();
    if (!booking) {
      const waId = await sendWhatsAppInteractive(phone, `❌ لم يتم العثور على حجز #${bookingNum}.`, [{ id: "btn_bookings", title: "📋 حجوزاتي" }], settings);
      saveBotMessage(supabase, convId, `لم يوجد حجز #${bookingNum}`, waId);
      return true;
    }
    if (booking.status === "cancelled" || booking.status === "completed") {
      const waId = await sendWhatsAppInteractive(phone, `⚠️ الحجز #${bookingNum} ${booking.status === "cancelled" ? "ملغي مسبقاً" : "مكتمل"}.`, [{ id: "btn_bookings", title: "📋 حجوزاتي" }], settings);
      saveBotMessage(supabase, convId, `حجز #${bookingNum} غير قابل للإلغاء`, waId);
      return true;
    }
    const waId = await sendWhatsAppInteractive(phone, `⚠️ هل تريد إلغاء الحجز #${bookingNum} في ${booking.stations?.name}؟`, [
      { id: `cancelconfirm_${bookingNum}`, title: "✅ نعم، إلغاء" },
      { id: "cancelback", title: "❌ لا، رجوع" },
    ], settings);
    saveBotMessage(supabase, convId, `تأكيد إلغاء #${bookingNum}`, waId);
    return true;
  }

  // Confirm cancellation
  const cancelConfirmMatch = input.match(/^cancelconfirm_(\d+)$/);
  if (cancelConfirmMatch) {
    const bookingNum = parseInt(cancelConfirmMatch[1]);
    await supabase.from("bookings").update({ status: "cancelled" }).eq("booking_number", bookingNum).eq("customer_phone", phone);
    const cancelMsg = replaceTemplateVars(settings.BOT_CANCELLATION_MESSAGE || "تم إلغاء الحجز #{booking_number} بنجاح. ✅", { booking_number: String(bookingNum) });
    const waId = await sendWhatsAppInteractive(phone, cancelMsg, [
      { id: "btn_bookings", title: "📋 حجوزاتي" },
      { id: "btn_menu", title: "🏠 القائمة" },
    ], settings);
    saveBotMessage(supabase, convId, cancelMsg, waId);
    updateSession(supabase, phone, { current_step: "idle" });
    return true;
  }

  // Cancel back — return to bookings list
  if (input === "cancelback") {
    return await showMyBookings(supabase, phone, convId, settings);
  }

  // Check bookings command (text fallback)
  if (input === "حجوزاتي" || input === "حجوزات") {
    return await showMyBookings(supabase, phone, convId, settings);
  }

  const step = session.current_step;

  // Handle location message - find nearest station
  if (locationData) {
    return await handleLocationMessage(supabase, phone, convId, settings, locationData);
  }

  // Waiting for owner response — send interactive buttons
  if (step === "awaiting_owner_response") {
    const waId = await sendWhatsAppInteractive(phone, "⏳ حجزك قيد المراجعة من قبل إدارة المغسلة.\nسنبلغك فور الرد.", [
      { id: "btn_bookings", title: "📋 حجوزاتي" },
      { id: "btn_menu", title: "🏠 القائمة" },
    ], settings);
    saveBotMessage(supabase, convId, "⏳ حجزك قيد المراجعة", waId);
    return true;
  }

  // ── Conflict: customer has a pending booking ──
  if (step === "conflict_pending") {
    const bookingId = session.pending_booking_id;
    if (input === "conflict_cancel") {
      // Only cancel if still pending — never touch confirmed bookings
      if (bookingId) await supabase.from("bookings").update({ status: "cancelled" }).eq("id", bookingId).eq("status", "pending");
      updateSession(supabase, phone, { current_step: "idle", conflict_booking_id: null });
      return await showCustomerWelcome(supabase, phone, convId, settings, contactName);
    }
    if (input === "conflict_reschedule") {
      // Jump directly to time slots for the same station+service
      const { data: oldBooking } = await supabase.from("bookings")
        .select("station_id, service_id, stations(scheduling_type, working_hours_start, working_hours_end, slot_duration_minutes, name)")
        .eq("id", bookingId).single();
      if (!oldBooking) {
        updateSession(supabase, phone, { current_step: "idle", conflict_booking_id: null });
        return await showCustomerWelcome(supabase, phone, convId, settings, contactName);
      }
      // Only cancel if still pending — never touch confirmed bookings
      await supabase.from("bookings").update({ status: "cancelled" }).eq("id", bookingId).eq("status", "pending");
      updateSession(supabase, phone, { conflict_booking_id: null });

      const st = oldBooking.stations as any;
      const sType = st?.scheduling_type || "slots";

      if (sType === "instant" || sType === "daily") {
        // Daily — jump to day picker
        const dayRows: any[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(Date.now() + 3 * 60 * 60 * 1000);
          d.setUTCDate(d.getUTCDate() + i);
          const lbl = i === 0 ? "اليوم" : i === 1 ? "غداً" : d.toLocaleDateString("ar-IQ", { calendar: "gregory", weekday: "long", month: "short", day: "numeric" });
          dayRows.push({ id: `day_${i}`, title: lbl });
        }
        dayRows.push({ id: "day_back", title: "🔙 رجوع" });
        const waId = await sendWhatsAppList(phone, "📅 اختر يوماً جديداً للحجز:", "اختر اليوم", [{ title: "الأيام المتاحة", rows: dayRows }], settings);
        saveBotMessage(supabase, convId, "اختيار يوم جديد", waId);
        updateSession(supabase, phone, { current_step: "awaiting_day", selected_station_id: oldBooking.station_id, selected_service_id: oldBooking.service_id });
        return true;
      } else {
        // Slots — jump directly to time picker for today
        const iraqNow = new Date(Date.now() + 3 * 60 * 60 * 1000);
        const today = iraqNow.toISOString().split("T")[0];
        const allSlots = generateTimeSlots(st?.working_hours_start, st?.working_hours_end, st?.slot_duration_minutes);
        const { data: booked } = await supabase.from("bookings").select("booking_time")
          .eq("station_id", oldBooking.station_id).eq("booking_date", today).in("status", ["pending", "confirmed"]);
        const bookedSet = new Set((booked || []).map((b: any) => b.booking_time?.substring(0, 5)));
        const nowMin = iraqNow.getUTCHours() * 60 + iraqNow.getUTCMinutes();
        const available = allSlots.filter((s: string) => {
          const [h, m] = s.split(":").map(Number);
          return h * 60 + m > nowMin && !bookedSet.has(s);
        });
        if (available.length === 0) {
          // No slots today — fall back to day picker
          const dayRows2: any[] = [];
          for (let i = 1; i < 7; i++) {
            const d = new Date(Date.now() + 3 * 60 * 60 * 1000);
            d.setUTCDate(d.getUTCDate() + i);
            dayRows2.push({ id: `day_${i}`, title: i === 1 ? "غداً" : d.toLocaleDateString("ar-IQ", { calendar: "gregory", weekday: "long", month: "short", day: "numeric" }) });
          }
          dayRows2.push({ id: "day_back", title: "🔙 رجوع" });
          const waId2 = await sendWhatsAppList(phone, `⚠️ لا توجد مواعيد اليوم في ${st?.name || "المغسلة"}.
📅 اختر يوماً آخر:`, "اختر اليوم", [{ title: "الأيام المتاحة", rows: dayRows2 }], settings);
          saveBotMessage(supabase, convId, "لا مواعيد اليوم", waId2);
          updateSession(supabase, phone, { current_step: "awaiting_day", selected_station_id: oldBooking.station_id, selected_service_id: oldBooking.service_id });
          return true;
        }
        const timeRows = available.slice(0, 9).map((s: string) => ({ id: `time_${s}`, title: to12Hour(s) }));
        timeRows.push({ id: "time_back", title: "🔙 رجوع" });
        const waId3 = await sendWhatsAppList(phone, `📅 اختر موعداً جديداً في ${st?.name || "المغسلة"}:`, "اختر موعداً", [{ title: "المواعيد المتاحة", rows: timeRows }], settings);
        saveBotMessage(supabase, convId, "اختيار موعد جديد", waId3);
        updateSession(supabase, phone, { current_step: "awaiting_time", selected_station_id: oldBooking.station_id, selected_service_id: oldBooking.service_id, selected_date: today });
        return true;
      }
    }
    // Fallback: resend conflict buttons
    const { data: cb } = await supabase.from("bookings").select("booking_number, stations(name)").eq("id", bookingId).single();
    const stName = (cb?.stations as any)?.name || "المغسلة";
    const fbWaId = await sendWhatsAppInteractive(phone,
      `لديك حجز قيد الانتظار في مغسلة ${stName}. ماذا تود أن تفعل؟`,
      [{ id: "conflict_cancel", title: "🗑️ إلغاء والبدء من جديد" }, { id: "conflict_reschedule", title: "📅 تعديل وقت الحجز" }],
      settings);
    saveBotMessage(supabase, convId, "تعارض حجز", fbWaId);
    return true;
  }

  // ── Timeout alert: owner didn't respond in 10 min ──
  if (step === "timeout_alert") {
    const bookingId = session.timeout_booking_id;
    if (input === "timeout_wait") {
      // Customer chose to keep waiting
      updateSession(supabase, phone, { current_step: "awaiting_owner_response", timeout_booking_id: null });
      const waId = await sendWhatsAppInteractive(phone,
        "⏳ حسناً، سنستمر في الانتظار.\nسنبلغك فور رد صاحب المغسلة.",
        [{ id: "btn_bookings", title: "📋 حجوزاتي" }, { id: "btn_menu", title: "🏠 القائمة" }],
        settings);
      saveBotMessage(supabase, convId, "استمرار الانتظار", waId);
      return true;
    }
    if (input === "timeout_search") {
      // Cancel timed-out booking and go to nearby stations
      if (bookingId) {
        const { data: tb } = await supabase.from("bookings")
          .select("station_id, service_id")
          .eq("id", bookingId).single();
        await supabase.from("bookings").update({ status: "cancelled" }).eq("id", bookingId);
        // Restore service selection in session so nearby list skips re-selection
        updateSession(supabase, phone, {
          current_step: "idle",
          timeout_booking_id: null,
          selected_service_id: tb?.service_id || null,
        });
      } else {
        updateSession(supabase, phone, { current_step: "idle", timeout_booking_id: null });
      }
      return await showCustomerWelcome(supabase, phone, convId, settings, contactName);
    }
    // Fallback: resend buttons
    const { data: tb2 } = await supabase.from("bookings")
      .select("stations(name)").eq("id", bookingId).single();
    const tStName = (tb2?.stations as any)?.name || "المغسلة";
    const fbWaId = await sendWhatsAppInteractive(phone,
      `مغسلة ${tStName} تأخرت في الرد. هل تود الاستمرار في الانتظار أم البحث عن مغسلة أخرى؟`,
      [{ id: "timeout_wait", title: "⏳ الانتظار" }, { id: "timeout_search", title: "🔍 البحث عن مغسلة أخرى" }],
      settings);
    saveBotMessage(supabase, convId, "تنبيه انتهاء المهلة", fbWaId);
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

  // ── Customer confirms or edits booking summary ──
  if (step === "awaiting_booking_confirm") {
    if (input === "confirm_booking") {
      // Proceed to create booking with stored session data
      return await createBookingAndNotifyOwner(
        supabase, phone, convId, settings,
        session.selected_station_id, session.selected_service_id,
        session.selected_date, session.selected_time
      );
    }
    if (input === "edit_booking") {
      // Go back to time/day picker for same station+service
      const { data: editSt } = await supabase.from("stations")
        .select("scheduling_type, working_hours_start, working_hours_end, slot_duration_minutes, name")
        .eq("id", session.selected_station_id).single();
      if (!editSt) {
        updateSession(supabase, phone, { current_step: "idle" });
        return await showCustomerWelcome(supabase, phone, convId, settings, contactName);
      }
      if (editSt.scheduling_type === "daily") {
        const dayRows: any[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(Date.now() + 3 * 60 * 60 * 1000);
          d.setUTCDate(d.getUTCDate() + i);
          const label = i === 0 ? "اليوم" : i === 1 ? "غداً" : d.toLocaleDateString("ar-IQ", { calendar: "gregory", weekday: "long", month: "short", day: "numeric" });
          dayRows.push({ id: `day_${i}`, title: label });
        }
        dayRows.push({ id: "day_back", title: "🔙 رجوع" });
        const editWaId = await sendWhatsAppList(phone, "✏️ تعديل الحجز — اختر يوماً جديداً:", "اختر اليوم", [{ title: "الأيام المتاحة", rows: dayRows }], settings);
        saveBotMessage(supabase, convId, "تعديل الحجز — اختيار يوم", editWaId);
        updateSession(supabase, phone, { current_step: "awaiting_day" });
        return true;
      } else {
        // slots or instant — re-show time picker
        const iraqNow = new Date(Date.now() + 3 * 60 * 60 * 1000);
        const editDate = session.selected_date || iraqNow.toISOString().split("T")[0];
        const allSlots = generateTimeSlots(editSt.working_hours_start, editSt.working_hours_end, editSt.slot_duration_minutes);
        const { data: booked } = await supabase.from("bookings").select("booking_time")
          .eq("station_id", session.selected_station_id).eq("booking_date", editDate)
          .in("status", ["pending", "confirmed"]);
        const bookedSet = new Set((booked || []).map((b: any) => b.booking_time?.substring(0, 5)));
        const nowMin = iraqNow.getUTCHours() * 60 + iraqNow.getUTCMinutes();
        const available = allSlots.filter((s: string) => {
          const [h, m] = s.split(":").map(Number);
          return h * 60 + m > nowMin && !bookedSet.has(s);
        });
        if (available.length === 0) {
          const noEditWaId = await sendWhatsAppInteractive(phone, `⚠️ لا توجد مواعيد أخرى متاحة اليوم في ${editSt.name}.`, [
            { id: "btn_menu", title: "🏠 القائمة الرئيسية" },
          ], settings);
          saveBotMessage(supabase, convId, "لا مواعيد أخرى لتعديل الحجز", noEditWaId);
          updateSession(supabase, phone, { current_step: "idle" });
          return true;
        }
        const editTimeRows = available.slice(0, 9).map((s: string) => ({ id: `time_${s}`, title: to12Hour(s) }));
        editTimeRows.push({ id: "time_back", title: "🔙 رجوع" });
        const editTimeWaId = await sendWhatsAppList(phone, `✏️ تعديل الحجز — اختر وقتاً جديداً في ${editSt.name}:`, "اختر موعداً", [{ title: "المواعيد المتاحة", rows: editTimeRows }], settings);
        saveBotMessage(supabase, convId, "تعديل الحجز — اختيار وقت", editTimeWaId);
        updateSession(supabase, phone, { current_step: "awaiting_time" });
        return true;
      }
    }
    // Fallback: resend summary
    if (session.selected_station_id && session.selected_service_id && session.selected_date) {
      return await showBookingSummary(supabase, phone, convId, settings,
        session.selected_station_id, session.selected_service_id,
        session.selected_date, session.selected_time);
    }
    updateSession(supabase, phone, { current_step: "idle" });
    return await showCustomerWelcome(supabase, phone, convId, settings, contactName);
  }

  // ── Customer confirms/rejects owner-proposed new time ──
  if (step === "awaiting_new_time_approval") {
    const bookingId = session.pending_booking_id;
    if (!bookingId) {
      updateSession(supabase, phone, { current_step: "idle" });
      return await showCustomerWelcome(supabase, phone, convId, settings, contactName);
    }
    if (input === "new_time_accept") {
      // Fetch proposed booking details
      const { data: pb } = await supabase.from("bookings")
        .select("booking_number, proposed_time, proposed_date, station_id, stations(name, address, latitude, longitude), services(name, price)")
        .eq("id", bookingId).single();
      if (!pb) {
        updateSession(supabase, phone, { current_step: "idle", pending_booking_id: null });
        return await showCustomerWelcome(supabase, phone, convId, settings, contactName);
      }
      // Confirm with proposed time
      await supabase.from("bookings").update({
        status: "confirmed" as any,
        booking_time: pb.proposed_time,
        booking_date: pb.proposed_date,
      }).eq("id", bookingId);
      const timeLabel = pb.proposed_time ? to12Hour(pb.proposed_time.substring(0, 5)) : "-";
      const dateFormatted = new Date(pb.proposed_date || "").toLocaleDateString("ar-IQ", { calendar: "gregory", weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const custConfirmMsg = `✅ تم تأكيد حجزك بالوقت الجديد!\n\n📍 المحطة: ${(pb.stations as any)?.name || ""}\n🔧 الخدمة: ${pb.services?.name || ""}\n💰 السعر: ${pb.services?.price || ""} د.ع\n📅 التاريخ: ${dateFormatted}\n🕐 الوقت: ${timeLabel}\n📋 رقم الحجز: #${pb.booking_number}\n\nنتمنى لك تجربة رائعة! 🚗✨`;
      await sendAndSave(supabase, convId, phone, custConfirmMsg, settings);
      // Follow-up buttons for customer
      const acceptFollowWaId = await sendWhatsAppInteractive(phone, "ماذا تريد أن تفعل؟", [
        { id: "btn_bookings", title: "📋 حجوزاتي" },
        { id: "btn_menu", title: "🏠 القائمة الرئيسية" },
      ], settings);
      saveBotMessage(supabase, convId, "أزرار بعد قبول الوقت البديل", acceptFollowWaId);
      updateSession(supabase, phone, { current_step: "idle", pending_booking_id: null });
      // Notify station owner
      const { data: stOwner } = await supabase.from("station_owners").select("owner_phone, owner_name").eq("station_id", pb.station_id).maybeSingle();
      if (stOwner?.owner_phone) {
        const ownerPhone = normalizePhone(stOwner.owner_phone);
        const ownerConvId = await getOrCreateConvForPhone(supabase, ownerPhone, stOwner.owner_name);
        if (ownerConvId) {
          const ownerMsg = `✅ قَبِل العميل الوقت البديل!\n\n📋 الحجز #${pb.booking_number} أصبح مؤكداً\n⏰ الوقت: ${timeLabel}`;
          await sendAndSave(supabase, ownerConvId, ownerPhone, ownerMsg, settings);
          await showOwnerMenu(supabase, ownerPhone, ownerConvId, settings, { ...stOwner, station_id: pb.station_id, stations: pb.stations });
        }
      }
      return true;
    }
    if (input === "new_time_reject") {
      // Cancel booking and let customer search for another station
      await supabase.from("bookings").update({ status: "cancelled" as any }).eq("id", bookingId);
      const { data: rejBk } = await supabase.from("bookings").select("service_id").eq("id", bookingId).single();
      updateSession(supabase, phone, {
        current_step: "idle",
        pending_booking_id: null,
        selected_service_id: rejBk?.service_id || null,
      });
      const rejectWaId = await sendWhatsAppInteractive(phone,
        "❌ تم رفض الوقت البديل وإلغاء الحجز.\n\nيمكنك البحث عن مغسلة أخرى:",
        [{ id: "btn_search", title: "🔍 بحث عن مغسلة" }, { id: "btn_menu", title: "🏠 القائمة الرئيسية" }],
        settings);
      saveBotMessage(supabase, convId, "رفض الوقت البديل", rejectWaId);
      return true;
    }
    // Fallback: resend buttons
    const { data: pbFb } = await supabase.from("bookings").select("booking_number, proposed_time, stations(name)").eq("id", bookingId).single();
    const propTimeLabel = pbFb?.proposed_time ? to12Hour(pbFb.proposed_time.substring(0, 5)) : "-";
    const fbWaId = await sendWhatsAppInteractive(phone,
      `هل توافق على الوقت البديل ${propTimeLabel} في مغسلة ${(pbFb?.stations as any)?.name || ""}؟`,
      [{ id: "new_time_accept", title: "✅ موافق على الوقت الجديد" }, { id: "new_time_reject", title: "🔍 رفض والبحث عن مغسلة أخرى" }],
      settings);
    saveBotMessage(supabase, convId, "إعادة إرسال اقتراح الوقت", fbWaId);
    return true;
  }

  // Unknown step — show buttons, no text typing required
  updateSession(supabase, phone, { current_step: "idle" });
  const unknownWaId = await sendWhatsAppInteractive(phone,
    settings.BOT_UNKNOWN_MESSAGE || "عذراً، لم أفهم. اختر من القائمة:",
    [
      { id: "btn_menu", title: "🏠 القائمة الرئيسية" },
      { id: "btn_bookings", title: "📋 حجوزاتي" },
    ], settings);
  saveBotMessage(supabase, convId, "القائمة الرئيسية", unknownWaId);
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
  const suspendedIds = await getSuspendedStationIds(supabase);

  let listQuery = supabase.from("stations").select("id, name, address").eq("is_active", true).order("created_at").range(offset, offset + STATIONS_PER_PAGE - 1);
  let countQuery = supabase.from("stations").select("id", { count: "exact", head: true }).eq("is_active", true);
  if (suspendedIds.length > 0) {
    const ids = suspendedIds.join(",");
    listQuery = listQuery.not("id", "in", `(${ids})`);
    countQuery = countQuery.not("id", "in", `(${ids})`);
  }
  const [listResult, countResult] = await Promise.all([listQuery, countQuery]);
  const stations = listResult.data || [];
  const total = countResult.count || 0;
  const totalPages = Math.ceil(total / STATIONS_PER_PAGE);

  if (stations.length === 0) {
    const waId = await sendWhatsAppInteractive(phone, "لا توجد مغاسل متاحة حالياً.", [
      { id: "btn_menu", title: "🏠 القائمة الرئيسية" },
    ], settings);
    saveBotMessage(supabase, convId, "لا توجد مغاسل", waId);
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
  const suspendedIds = await getSuspendedStationIds(supabase);
  let q = supabase.from("stations").select("id, name, address")
    .eq("is_active", true).or(`name.ilike.%${query}%,address.ilike.%${query}%`).order("created_at").limit(10);
  if (suspendedIds.length > 0) q = q.not("id", "in", `(${suspendedIds.join(",")})`);
  const { data: stations } = await q;

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
  const suspendedIds = await getSuspendedStationIds(supabase);
  let q = supabase.from("stations").select("id, name, address, latitude, longitude").eq("is_active", true);
  if (suspendedIds.length > 0) q = q.not("id", "in", `(${suspendedIds.join(",")})`);
  const { data: stations } = await q;

  if (!stations || stations.length === 0) {
    await sendAndSave(supabase, convId, phone, "عذراً، لا توجد مغاسل متاحة حالياً.", settings);
    return true;
  }

  const MAX_RADIUS_KM = 15;

  // Calculate distance for all stations that have coordinates
  const withDist = stations
    .filter((s: any) => s.latitude != null && s.longitude != null)
    .map((s: any) => ({
      ...s,
      distance: haversineDistance(loc.latitude, loc.longitude, parseFloat(s.latitude), parseFloat(s.longitude)),
    }))
    .filter((s: any) => s.distance < MAX_RADIUS_KM)
    .sort((a: any, b: any) => a.distance - b.distance);

  if (withDist.length === 0) {
    // Fall back: show the closest station even if it's beyond the radius
    const allWithDist = stations
      .filter((s: any) => s.latitude != null && s.longitude != null)
      .map((s: any) => ({
        ...s,
        distance: haversineDistance(loc.latitude, loc.longitude, parseFloat(s.latitude), parseFloat(s.longitude)),
      }))
      .sort((a: any, b: any) => a.distance - b.distance);

    if (allWithDist.length === 0) {
      // No stations have coordinates — show text list
      await sendAndSave(supabase, convId, phone, `📍 لا توجد مغاسل بإحداثيات محددة ضمن ${MAX_RADIUS_KM} كم.\nأرسل "قائمة" لعرض جميع المغاسل.`, settings);
      return true;
    }

    const closest = allWithDist[0];
    const distStr = closest.distance >= 1 ? `${closest.distance.toFixed(1)} كم` : `${Math.round(closest.distance * 1000)} م`;
    const waId = await sendWhatsAppInteractive(phone,
      `📍 لا توجد مغاسل ضمن ${MAX_RADIUS_KM} كم من موقعك.\n\nأقرب مغسلة إليك هي *${closest.name}* على بُعد ${distStr}.`,
      [
        { id: `sid_${closest.id}`, title: `🏪 ${closest.name}`.substring(0, 20) },
        { id: "btn_menu", title: "🔍 عرض كل المغاسل" },
      ], settings);
    saveBotMessage(supabase, convId, `أقرب مغسلة: ${closest.name}`, waId);
    updateSession(supabase, phone, { current_step: "awaiting_station" });
    return true;
  }

  // Format distance: meters if < 1km, km otherwise
  function fmtDist(km: number): string {
    return km < 1 ? `${Math.round(km * 1000)} م` : `${km.toFixed(1)} كم`;
  }

  const nearby = withDist.slice(0, 10);
  const rows = nearby.map((s: any) => ({
    id: `sid_${s.id}`,
    title: s.name.substring(0, 24),
    description: `📍 ${fmtDist(s.distance)} • ⏱ ${estimateMinutes(s.distance)} د${s.address ? " • " + s.address.substring(0, 30) : ""}`.substring(0, 72),
  }));
  rows.push({ id: "btn_menu", title: "🔍 عرض جميع المغاسل" });

  const body = `📍 وجدنا *${nearby.length}* مغسلة قريبة منك (ضمن ${MAX_RADIUS_KM} كم)\nمرتبة من الأقرب إلى الأبعد:`;

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
    const waId = await sendWhatsAppInteractive(phone, `عذراً، لا توجد خدمات متاحة في ${stationName} حالياً.`, [
      { id: "btn_menu", title: "🏠 القائمة الرئيسية" },
    ], settings);
    saveBotMessage(supabase, convId, `لا توجد خدمات في ${stationName}`, waId);
    return true;
  }

  const rows = services.slice(0, 9).map((s: any) => ({
    id: `svc_${s.id}`,
    title: s.name.substring(0, 24),
    description: `${s.price} د.ع`,
  }));
  rows.push({ id: "svc_back", title: "🔙 رجوع للقائمة" });

  const body = stationName ? `✅ اخترت: ${stationName}\n\nاختر الخدمة:` : "اختر الخدمة:";
  const waId = await sendWhatsAppList(phone, body, "اختر الخدمة", [{ title: "الخدمات المتاحة", rows }], settings);
  saveBotMessage(supabase, convId, body, waId);
  updateSession(supabase, phone, { current_step: "awaiting_service", selected_station_id: stationId });
  return true;
}

async function handleServiceSelection(supabase: any, phone: string, convId: string, settings: Record<string, string>, session: any, input: string) {
  const stationId = session.selected_station_id;

  // Handle list reply ID: svc_UUID
  const svcMatch = input.match(/^svc_([a-f0-9-]+)$/i);
  if (!svcMatch) {
    updateSession(supabase, phone, { current_step: "idle" });
    return await showCustomerWelcome(supabase, phone, convId, settings);
  }

  // Fetch the selected service and station in parallel
  const [serviceResult, stationResult] = await Promise.all([
    supabase.from("services").select("id, name, price").eq("id", svcMatch[1]).single(),
    supabase.from("stations").select("*").eq("id", stationId).single(),
  ]);
  const service = serviceResult.data;
  const station = stationResult.data;

  if (!service || !station) {
    const waId = await sendWhatsAppInteractive(phone, "❌ حدث خطأ. حاول مرة أخرى.", [{ id: "btn_menu", title: "🏠 القائمة الرئيسية" }], settings);
    saveBotMessage(supabase, convId, "خطأ في اختيار الخدمة", waId);
    return true;
  }

  // After-hours check for instant booking
  if (station.scheduling_type === "instant") {
    if (settings.BOT_AFTER_HOURS_ENABLED === "true" && station.working_hours_start && station.working_hours_end) {
      const nowMin = new Date(Date.now() + 3 * 60 * 60 * 1000).getUTCHours() * 60 + new Date(Date.now() + 3 * 60 * 60 * 1000).getUTCMinutes();
      const [sh, sm] = station.working_hours_start.split(":").map(Number);
      const [eh, em] = station.working_hours_end.split(":").map(Number);
      if (nowMin < sh * 60 + sm || nowMin > eh * 60 + em) {
        const afterMsg = replaceTemplateVars(settings.BOT_AFTER_HOURS_MESSAGE || "عذراً، المغسلة مغلقة حالياً. مواعيد العمل: {start} - {end}", { start: station.working_hours_start, end: station.working_hours_end, station: station.name });
        const ahWaId = await sendWhatsAppInteractive(phone, afterMsg, [{ id: "btn_menu", title: "🏠 القائمة الرئيسية" }], settings);
        saveBotMessage(supabase, convId, afterMsg, ahWaId);
        return true;
      }
    }
    return await showBookingSummary(supabase, phone, convId, settings, stationId, service.id, new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split("T")[0], null);
  }

  // Daily — show day picker as list
  if (station.scheduling_type === "daily") {
    const dayRows: any[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.now() + 3 * 60 * 60 * 1000);
      d.setUTCDate(d.getUTCDate() + i);
      const label = i === 0 ? "اليوم" : i === 1 ? "غداً" : d.toLocaleDateString("ar-IQ", { calendar: "gregory", weekday: "long", month: "short", day: "numeric" });
      dayRows.push({ id: `day_${i}`, title: label });
    }
    dayRows.push({ id: "day_back", title: "🔙 رجوع" });
    const body = `✅ اخترت: ${service.name} - ${service.price} د.ع\n\nاختر اليوم:`;
    const waId = await sendWhatsAppList(phone, body, "اختر اليوم", [{ title: "الأيام المتاحة", rows: dayRows }], settings);
    saveBotMessage(supabase, convId, body, waId);
    updateSession(supabase, phone, { current_step: "awaiting_day", selected_service_id: service.id });
    return true;
  }

  // Slots — show time picker as list
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
    const fbWaId = await sendWhatsAppInteractive(phone, fullyBookedMsg, [{ id: "btn_menu", title: "🏠 القائمة الرئيسية" }], settings);
    saveBotMessage(supabase, convId, fullyBookedMsg, fbWaId);
    return true;
  }

  const timeRows = available.slice(0, 9).map((s: string) => ({ id: `time_${s}`, title: to12Hour(s) }));
  timeRows.push({ id: "time_back", title: "🔙 رجوع" });
  const timeBody = `✅ اخترت: ${service.name} - ${service.price} د.ع\n\nالمواعيد المتاحة اليوم:`;
  const timeWaId = await sendWhatsAppList(phone, timeBody, "اختر موعداً", [{ title: "المواعيد المتاحة", rows: timeRows }], settings);
  saveBotMessage(supabase, convId, timeBody, timeWaId);
  updateSession(supabase, phone, { current_step: "awaiting_time", selected_service_id: service.id, selected_date: today });
  return true;
}

async function handleDaySelection(supabase: any, phone: string, convId: string, settings: Record<string, string>, session: any, input: string) {
  const dayMatch = input.match(/^day_(\d)$/);
  if (!dayMatch) {
    updateSession(supabase, phone, { current_step: "idle" });
    return await showCustomerWelcome(supabase, phone, convId, settings);
  }

  const idx = parseInt(dayMatch[1]);
  const d = new Date(Date.now() + 3 * 60 * 60 * 1000);
  d.setUTCDate(d.getUTCDate() + idx);
  const selectedDate = d.toISOString().split("T")[0];

  return await showBookingSummary(supabase, phone, convId, settings, session.selected_station_id, session.selected_service_id, selectedDate, null);
}

async function handleTimeSelection(supabase: any, phone: string, convId: string, settings: Record<string, string>, session: any, input: string) {
  const timeMatch = input.match(/^time_(\d{2}:\d{2})$/);
  if (!timeMatch) {
    updateSession(supabase, phone, { current_step: "idle" });
    return await showCustomerWelcome(supabase, phone, convId, settings);
  }

  return await showBookingSummary(supabase, phone, convId, settings, session.selected_station_id, session.selected_service_id, session.selected_date, timeMatch[1]);
}

// ==================== BOOKING SUMMARY (BEFORE CREATING) ====================

async function showBookingSummary(
  supabase: any, phone: string, convId: string, settings: Record<string, string>,
  stationId: string, serviceId: string, bookingDate: string, bookingTime: string | null
) {
  const [stationResult, serviceResult] = await Promise.all([
    supabase.from("stations").select("name").eq("id", stationId).single(),
    supabase.from("services").select("name, price").eq("id", serviceId).single(),
  ]);
  const station = stationResult.data;
  const service = serviceResult.data;
  const dateFormatted = new Date(bookingDate).toLocaleDateString("ar-IQ", { calendar: "gregory", weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeLabel = bookingTime ? to12Hour(bookingTime) : "—";
  const summaryMsg = `📋 ملخص الحجز\n\n📍 المحطة: ${station?.name || ""}\n🔧 الخدمة: ${service?.name || ""}\n💰 السعر: ${service?.price || ""} د.ع\n📅 التاريخ: ${dateFormatted}${bookingTime ? "\n🕐 الوقت: " + timeLabel : ""}\n\nهل تريد تأكيد الحجز؟`;
  const waId = await sendWhatsAppInteractive(phone, summaryMsg, [
    { id: "confirm_booking", title: "✅ تأكيد الحجز" },
    { id: "edit_booking", title: "✏️ تعديل الحجز" },
  ], settings);
  saveBotMessage(supabase, convId, summaryMsg, waId);
  updateSession(supabase, phone, {
    current_step: "awaiting_booking_confirm",
    selected_station_id: stationId,
    selected_service_id: serviceId,
    selected_date: bookingDate,
    selected_time: bookingTime,
  });
  return true;
}

// ==================== CREATE BOOKING & NOTIFY OWNER ====================

async function createBookingAndNotifyOwner(
  supabase: any, phone: string, convId: string, settings: Record<string, string>,
  stationId: string, serviceId: string, bookingDate: string, bookingTime: string | null,
  vehicleDetails: string | null = null
) {
  // ── Anti-spam: check if customer already has a pending booking ──
  const { data: existingPending } = await supabase.from("bookings")
    .select("id, booking_number, stations(name)")
    .eq("customer_phone", phone)
    .eq("status", "pending")
    .maybeSingle();

  if (existingPending) {
    const stName = (existingPending.stations as any)?.name || "المغسلة";
    const conflictWaId = await sendWhatsAppInteractive(
      phone,
      `⚠️ لديك حجز قيد الانتظار حالياً في مغسلة ${stName} (رقم #${existingPending.booking_number}).\nماذا تود أن تفعل؟`,
      [
        { id: "conflict_cancel", title: "🗑️ إلغاء والبدء من جديد" },
        { id: "conflict_reschedule", title: "📅 تعديل وقت الحجز" },
      ],
      settings
    );
    saveBotMessage(supabase, convId, "تعارض حجز معلق", conflictWaId);
    updateSession(supabase, phone, { current_step: "conflict_pending", pending_booking_id: existingPending.id });
    return true;
  }

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
    vehicle_details: vehicleDetails || null,
  };
  if (bookingTime) insertData.booking_time = bookingTime;

  const { data: booking } = await supabase.from("bookings").insert(insertData).select("id, booking_number").single();

  // ── رسالة الزبون: دائماً "في انتظار التأكيد" - لا نستخدم BOT_CONFIRMATION_MESSAGE هنا ──
  const dateLabel = new Date(bookingDate).toLocaleDateString("ar-IQ", { calendar: "gregory", weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeLabel = bookingTime ? to12Hour(bookingTime) : "";
  const pendingMsg = `📩 تم استلام طلب حجزك!\n\n📍 المحطة: ${station?.name || ""}\n🔧 الخدمة: ${service?.name || ""}\n💰 السعر: ${service?.price || ""} د.ع\n📅 التاريخ: ${dateLabel}${timeLabel ? "\n🕐 الوقت: " + timeLabel : ""}\n📋 رقم الحجز: #${booking?.booking_number || "---"}\n\n⏳ في انتظار تأكيد صاحب المغسلة...\nسنعلمك فور الرد.`;

  // إرسال رسالة الزبون + تحديث الجلسة معاً (بالتوازي مع إشعار المالك)
  updateSession(supabase, phone, { current_step: "awaiting_owner_response", selected_station_id: null, selected_service_id: null, selected_date: null, selected_time: null, vehicle_details: null });

  // ── إشعار صاحب المغسلة (awaited — حرج لضمان الإرسال قبل انتهاء الدالة) ──
  const notifyOwnerPromise = booking ? (async () => {
    try {
      const { data: owner, error: ownerErr } = await supabase.from("station_owners")
        .select("owner_phone, owner_name, stations(name)").eq("station_id", stationId).maybeSingle();
      if (ownerErr) console.error("[OWNER_NOTIFY] DB error:", ownerErr.message);
      if (!owner?.owner_phone) {
        console.error(`[OWNER_NOTIFY] No owner found for station_id=${stationId}. Booking #${booking.booking_number} orphaned.`);
        return;
      }
      // تأكد أن الرقم بصيغة دولية بدون + (مثال: 9647XXXXXXXX)
      const ownerPhone = normalizePhone(owner.owner_phone);
      const stationName = (owner.stations as any)?.name || station?.name || "محطتك";
      const ownerConvId = await getOrCreateConvForPhone(supabase, ownerPhone, owner.owner_name);

      const ownerMsg = `📢 طلب حجز جديد!\n\n📍 محطتك: ${stationName}\n🔧 الخدمة: ${service?.name || ""}\n💰 السعر: ${service?.price || ""} د.ع\n📅 التاريخ: ${dateLabel}${bookingTime ? "\n🕐 الوقت: " + to12Hour(bookingTime) : ""}\n📋 رقم الحجز: #${booking.booking_number}\n👤 العميل: ${customerName || phone}\n\nاختر أحد الأزرار:`;

      const ownerButtons = [
        { id: "approve_yes", title: "✅ تأكيد" },
        { id: "approve_no", title: "❌ رفض" },
        { id: `change_time_${booking.id}`, title: "📅 تغيير الموعد" },
      ];

      const ownerWaId = await sendWhatsAppInteractive(ownerPhone, ownerMsg, ownerButtons, settings);
      if (!ownerWaId) {
        console.error(`[OWNER_NOTIFY] sendWhatsAppInteractive returned null for ${ownerPhone}. Check WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in app_settings.`);
      } else {
        console.log(`[OWNER_NOTIFY] ✅ Sent to ${ownerPhone}, waId=${ownerWaId}`);
      }
      if (ownerConvId) {
        saveBotMessage(supabase, ownerConvId, ownerMsg, ownerWaId);
        await getOrCreateSession(supabase, ownerPhone);
        updateSession(supabase, ownerPhone, {
          current_step: "owner_approve_reject", pending_booking_id: booking.id, selected_station_id: stationId,
        });
      }
    } catch (e: any) {
      console.error("[OWNER_NOTIFY] Unexpected error:", e?.message || e);
    }
  })() : Promise.resolve();

  // ── إرسال رسالة الزبون + إشعار المالك + إشعار الأدمن معاً ──
  const custSend = sendAndSave(supabase, convId, phone, pendingMsg, settings);

  if (booking) {
    const adminMsg = `🔔 حجز جديد!\n\n📋 #${booking.booking_number}\n📱 العميل: ${customerName || phone}\n🏪 المحطة: ${station?.name}\n🔧 الخدمة: ${service?.name} — ${service?.price} د.ع\n📅 ${dateLabel}${bookingTime ? "\n🕐 " + to12Hour(bookingTime) : ""}`;
    notifyAdmin(supabase, settings, adminMsg, booking.id);
    incrementCustomerBookings(supabase, phone, "whatsapp");
  }

  // انتظر كلاهما: رسالة الزبون + إشعار المالك — لضمان الإرسال قبل إغلاق الدالة
  await Promise.all([custSend, notifyOwnerPromise]);
  return true;
}

// ==================== CANCEL / BOOKINGS ====================

async function showMyBookings(supabase: any, phone: string, convId: string, settings: Record<string, string>) {
  const { data: bookings } = await supabase.from("bookings")
    .select("booking_number, booking_date, booking_time, status, stations(name), services(name, price)")
    .eq("customer_phone", phone).in("status", ["pending", "confirmed"]).order("booking_date").limit(10);

  if (!bookings || bookings.length === 0) {
    const waId = await sendWhatsAppInteractive(phone, "لا توجد لديك حجوزات نشطة حالياً.", [
      { id: "btn_menu", title: "🏠 القائمة الرئيسية" },
    ], settings);
    saveBotMessage(supabase, convId, "لا توجد حجوزات نشطة", waId);
    return true;
  }

  const rows: any[] = bookings.map((b: any) => {
    const label = b.status === "confirmed" ? "✅ مؤكد" : "⏳ انتظار";
    const title = `#${b.booking_number} ${b.stations?.name || ""}`.substring(0, 24);
    const desc = `${b.services?.name} | ${b.booking_date}${b.booking_time ? " " + to12Hour(b.booking_time.substring(0, 5)) : ""} | ${label}`.substring(0, 72);
    return { id: `cancel_${b.booking_number}`, title, description: desc };
  });
  rows.push({ id: "btn_menu", title: "🏠 القائمة الرئيسية" });

  const body = "📋 حجوزاتك النشطة:\n(اختر حجزاً لإلغائه)";
  const waId = await sendWhatsAppList(phone, body, "عرض الحجوزات", [{ title: "الحجوزات", rows }], settings);
  saveBotMessage(supabase, convId, body, waId);
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
                const phone = normalizePhone(msg.from);
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

                // === ROUTING: Owner, Admin, or Customer? ===
                const owner = await checkIfOwner(supabase, phone);
                const isAdmin = checkIfAdmin(phone, settings);

                if (owner) {
                  const buttonId = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id;
                  const actualInput = buttonId || content;
                  await handleOwnerLogic(supabase, phone, actualInput, convId, settings, owner);
                } else if (isAdmin) {
                  const buttonId = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id;
                  const actualInput = buttonId || content;
                  await handleAdminLogic(supabase, phone, actualInput, convId, settings);
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
