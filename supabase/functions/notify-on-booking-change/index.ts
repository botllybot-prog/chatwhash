import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Language = "ar" | "en" | "ku";
type DeviceToken = {
  token: string;
  language: Language;
};

const INSERT_MESSAGES: Record<Language, { title: string; body: string }> = {
  en: {
    title: "New Booking",
    body: "You have a new booking at your station",
  },
  ar: {
    title: "حجز جديد",
    body: "لديك حجز جديد في محطتك",
  },
  ku: {
    title: "حجزێکی نوێ",
    body: "لە وێستگەکەت حجزێکی نوێت هەیە",
  },
};

const UPDATE_MESSAGES: Record<string, Record<Language, { title: string; body: string }>> = {
  confirmed: {
    en: {
      title: "Booking Confirmed",
      body: "Your booking has been confirmed",
    },
    ar: {
      title: "تم تأكيد الحجز",
      body: "تم تأكيد حجزك بنجاح",
    },
    ku: {
      title: "حجزەکە پشتڕاست کرایەوە",
      body: "حجزەکەت بە سەرکەوتوویی پشتڕاست کرایەوە",
    },
  },
  rejected: {
    en: {
      title: "Booking Rejected",
      body: "Sorry, your booking was rejected",
    },
    ar: {
      title: "تم رفض الحجز",
      body: "عذراً، تم رفض حجزك",
    },
    ku: {
      title: "حجزەکە ڕەتکرایەوە",
      body: "ببورە، حجزەکەت ڕەتکرایەوە",
    },
  },
  cancelled: {
    en: {
      title: "Booking Cancelled",
      body: "Your booking was cancelled",
    },
    ar: {
      title: "تم إلغاء الحجز",
      body: "تم إلغاء حجزك",
    },
    ku: {
      title: "حجزەکە هەڵوەشایەوە",
      body: "حجزەکەت هەڵوەشایەوە",
    },
  },
  pending_customer_approval: {
    en: {
      title: "Reschedule Request",
      body: "The station owner requested to reschedule your booking",
    },
    ar: {
      title: "طلب تأجيل",
      body: "صاحب المحطة طلب تغيير موعد الحجز",
    },
    ku: {
      title: "داوای گۆڕینی کات",
      body: "خاوەنی وێستگە داوای گۆڕینی کاتی حجزەکەی کردووە",
    },
  },
  completed: {
    en: {
      title: "Service Completed",
      body: "Thank you! Your car wash is complete",
    },
    ar: {
      title: "اكتملت الخدمة",
      body: "شكراً لك! تم إكمال غسل السيارة",
    },
    ku: {
      title: "خزمەتگوزارییەکە تەواو بوو",
      body: "سوپاس! شۆردنی ئۆتۆمبێلەکەت تەواو بوو",
    },
  },
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(phone: string): string {
  const western = String(phone || "")
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));
  const cleaned = western.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned;
}

function asLanguage(value: unknown): Language {
  return value === "en" || value === "ku" ? value : "ar";
}

function base64Url(input: string | ArrayBuffer): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, "\n");
  const base64 = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function createFirebaseJwt() {
  const clientEmail = Deno.env.get("FCM_CLIENT_EMAIL") || "";
  const privateKey = Deno.env.get("FCM_PRIVATE_KEY") || "";
  if (!clientEmail || !privateKey) throw new Error("Missing Firebase FCM secrets");

  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify({
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    iat: now,
    exp: now + 3600,
  }))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64Url(signature)}`;
}

async function getFirebaseAccessToken(): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: await createFirebaseJwt(),
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(`Firebase OAuth failed: ${payload.error_description || payload.error || response.status}`);
  }
  return String(payload.access_token);
}

async function sendFcm(accessToken: string, token: string, title: string, body: string, data: Record<string, string>) {
  const projectId = Deno.env.get("FCM_PROJECT_ID") || "";
  if (!projectId) throw new Error("Missing FCM_PROJECT_ID secret");

  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { success: false, token, error: payload.error?.message || response.statusText || response.status };
  }
  return { success: true, token, response: payload.name || null };
}

async function sendToTokens(tokens: DeviceToken[], messageForLanguage: Record<Language, { title: string; body: string }>, data: Record<string, string>) {
  if (tokens.length === 0) return [];
  const accessToken = await getFirebaseAccessToken();
  const results = [];
  for (const token of tokens) {
    const message = messageForLanguage[asLanguage(token.language)];
    results.push(await sendFcm(accessToken, token.token, message.title, message.body, data));
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const payload = await req.json();
    const type = String(payload.type || "").toUpperCase();
    const record = payload.record || {};
    const oldRecord = payload.old_record || {};
    const bookingId = String(record.id || "");

    if (type === "INSERT") {
      const stationId = String(record.station_id || "");
      if (!stationId) return json({ success: true, skipped: "missing_station_id" });

      const { data: owner } = await supabase
        .from("station_owners")
        .select("owner_phone")
        .eq("station_id", stationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const ownerPhone = normalizePhone(String(owner?.owner_phone || ""));
      if (!ownerPhone) return json({ success: true, skipped: "missing_owner_phone" });

      const { data: tokens, error } = await supabase
        .from("device_tokens")
        .select("token, language")
        .eq("phone", ownerPhone)
        .eq("role", "owner");

      if (error) return json({ error: error.message }, 500);
      const results = await sendToTokens((tokens || []) as DeviceToken[], INSERT_MESSAGES, {
        booking_id: bookingId,
        station_id: stationId,
        event: "booking_insert",
      });
      return json({ success: true, sent: results.filter((result) => result.success).length, results });
    }

    if (type === "UPDATE") {
      const status = String(record.status || "");
      if (String(oldRecord.status || "") === status) return json({ success: true, skipped: "status_unchanged" });
      const messages = UPDATE_MESSAGES[status];
      if (!messages) return json({ success: true, skipped: "status_not_notifiable" });

      const customerPhone = normalizePhone(String(record.customer_phone || ""));
      if (!customerPhone) return json({ success: true, skipped: "missing_customer_phone" });

      const { data: tokens, error } = await supabase
        .from("device_tokens")
        .select("token, language")
        .eq("phone", customerPhone)
        .eq("role", "customer");

      if (error) return json({ error: error.message }, 500);
      const results = await sendToTokens((tokens || []) as DeviceToken[], messages, {
        booking_id: bookingId,
        status,
        event: "booking_update",
      });
      return json({ success: true, sent: results.filter((result) => result.success).length, results });
    }

    return json({ success: true, skipped: "unsupported_event" });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
