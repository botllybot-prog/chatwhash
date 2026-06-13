import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DeviceToken = {
  token: string;
  language: string;
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

function base64Url(input: string | ArrayBuffer): string {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);
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
  if (!clientEmail || !privateKey) {
    throw new Error("Missing FCM_CLIENT_EMAIL or FCM_PRIVATE_KEY secret");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${base64Url(signature)}`;
}

async function getFirebaseAccessToken(): Promise<string> {
  const jwt = await createFirebaseJwt();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(`Firebase OAuth failed: ${payload.error_description || payload.error || response.status}`);
  }
  return String(payload.access_token);
}

function normalizeData(data: unknown): Record<string, string> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  return Object.fromEntries(
    Object.entries(data as Record<string, unknown>).map(([key, value]) => [key, String(value)]),
  );
}

async function sendFcmMessage(accessToken: string, token: string, title: string, body: string, data: Record<string, string>) {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const payload = await req.json();
    const phone = normalizePhone(String(payload.phone || ""));
    const role = String(payload.role || "");
    const title = String(payload.title || "").trim();
    const body = String(payload.body || "").trim();
    const data = normalizeData(payload.data);

    if (!phone || !["customer", "owner"].includes(role) || !title || !body) {
      return json({ error: "Missing or invalid phone, role, title, or body" }, 400);
    }

    const { data: rows, error } = await supabase
      .from("device_tokens")
      .select("token, language")
      .eq("phone", phone)
      .eq("role", role);

    if (error) return json({ error: error.message }, 500);

    const tokens = (rows || []) as DeviceToken[];
    if (tokens.length === 0) return json({ success: true, sent: 0, results: [] });

    const accessToken = await getFirebaseAccessToken();
    const results = [];
    for (const row of tokens) {
      results.push(await sendFcmMessage(accessToken, row.token, title, body, data));
    }

    return json({
      success: true,
      sent: results.filter((result) => result.success).length,
      failed: results.filter((result) => !result.success).length,
      results,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
