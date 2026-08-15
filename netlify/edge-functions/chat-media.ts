import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/edge-functions";

const STORE_NAME = "chat-media";
const ROUTE_PREFIX = "/api/chat-media";
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MEDIA_TYPE_PATTERN = /^(image|video)\/[a-z0-9][a-z0-9.+-]*$/;
const THREAD_ID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// Legacy keys were stored without a media-type segment, so their type is
// recovered from the file extension.
const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  avif: "image/avif",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  mov: "video/quicktime",
  mp4: "video/mp4",
  png: "image/png",
  webm: "video/webm",
  webp: "image/webp",
};

const isMediaType = (value: string) => MEDIA_TYPE_PATTERN.test(value);

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

const getBlobKey = (request: Request) => {
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith(`${ROUTE_PREFIX}/`)) return "";
  return decodeURIComponent(pathname.slice(ROUTE_PREFIX.length + 1));
};

const sanitizeFileName = (fileName: string) => {
  const normalized = fileName.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-");
  return normalized.replace(/^-+|-+$/g, "").slice(-120) || "media";
};

const decodeFileName = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return "media";
  }
};

const getContentType = (key: string) => {
  // Keys are stored as `<thread>/<id>/<media~type>/<file name>` so any image
  // or video type can be served back with the exact type it was uploaded with.
  const segments = key.split("/");
  if (segments.length >= 4) {
    const declared = segments[2].replace("~", "/").toLowerCase();
    if (isMediaType(declared)) return declared;
  }

  const extension = key.split(".").pop()?.toLowerCase() || "";
  return MIME_TYPES_BY_EXTENSION[extension] || "application/octet-stream";
};

const FALLBACK_SUPABASE_URL = "https://yhklvtzonvgzkodysawu.supabase.co";

const readEnv = (...names: string[]) => {
  for (const name of names) {
    const value = Netlify.env.get(name)?.trim();
    if (value) return value;
  }
  return "";
};

/**
 * Owner/admin side: the caller's own Supabase Auth token is checked against
 * chat_thread_members via PostgREST + RLS, mirroring offer-media.ts's
 * isAdminRequest pattern. RLS on chat_thread_members already grants SELECT
 * to thread members and admins, so a non-empty result IS the authorization.
 */
const isOwnerThreadMember = async (request: Request, threadId: string) => {
  const authorization = request.headers.get("authorization");
  const supabaseUrl = readEnv("VITE_SUPABASE_URL", "SUPABASE_URL") || FALLBACK_SUPABASE_URL;
  const publishableKey = readEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY");

  if (!authorization?.startsWith("Bearer ") || !supabaseUrl) return false;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/chat_thread_members?select=id&thread_id=eq.${encodeURIComponent(threadId)}&limit=1`,
    {
      headers: {
        apikey: publishableKey || authorization.slice("Bearer ".length).trim(),
        Authorization: authorization,
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) return false;
  const rows = (await response.json()) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
};

/**
 * Customer side: customers hold a phone-based session token, not a Supabase
 * Auth JWT (see customer_web_sessions / src/lib/customerSession.ts), so
 * there's no RLS to lean on. This requires the SUPABASE_SERVICE_ROLE_KEY
 * Netlify site env var (in addition to the URL/publishable key offer-media
 * already needs) to look up the session and membership directly, the same
 * way every customer-facing Supabase edge function already does.
 */
const isCustomerThreadMember = async (request: Request, threadId: string) => {
  const customerPhone = request.headers.get("x-customer-phone")?.trim() || "";
  const sessionToken = request.headers.get("x-customer-session-token")?.trim() || "";
  if (!customerPhone || !sessionToken) return false;

  const supabaseUrl = readEnv("VITE_SUPABASE_URL", "SUPABASE_URL") || FALLBACK_SUPABASE_URL;
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) return false;

  const serviceHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    Accept: "application/json",
  };

  const sessionResponse = await fetch(
    `${supabaseUrl}/rest/v1/customer_web_sessions?select=customer_phone,expires_at&session_token=eq.${encodeURIComponent(sessionToken)}`,
    { headers: serviceHeaders },
  );
  if (!sessionResponse.ok) return false;
  const sessions = (await sessionResponse.json()) as Array<{ customer_phone?: string; expires_at?: string }>;
  const session = sessions[0];
  if (!session || session.customer_phone !== customerPhone) return false;
  if (!session.expires_at || new Date(session.expires_at).getTime() < Date.now()) return false;

  const memberResponse = await fetch(
    `${supabaseUrl}/rest/v1/chat_thread_members?select=id&thread_id=eq.${encodeURIComponent(threadId)}&customer_phone=eq.${encodeURIComponent(customerPhone)}&limit=1`,
    { headers: serviceHeaders },
  );
  if (!memberResponse.ok) return false;
  const rows = (await memberResponse.json()) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
};

const isAuthorizedForThread = async (request: Request, threadId: string) => {
  if (!THREAD_ID_PATTERN.test(threadId)) return false;
  if (await isOwnerThreadMember(request, threadId)) return true;
  return await isCustomerThreadMember(request, threadId);
};

export default async (request: Request, _context: Context) => {
  const store = getStore({ name: STORE_NAME, consistency: "strong" });
  const key = getBlobKey(request);

  if (request.method === "GET") {
    if (!key) return json({ error: "Media key is required" }, 400);

    const media = await store.get(key, { type: "stream" });
    if (!media) return json({ error: "Media not found" }, 404);

    return new Response(media, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": getContentType(key),
        // Media is user-uploaded, so scripting is blocked for formats that can
        // carry it (such as SVG) when the file is opened directly.
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  if (request.method !== "POST" && request.method !== "DELETE") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (request.method === "DELETE") {
    if (!key) return json({ error: "Media key is required" }, 400);
    const threadId = key.split("/")[0] || "";
    if (!(await isAuthorizedForThread(request, threadId))) return json({ error: "Unauthorized" }, 401);

    await store.delete(key);
    return new Response(null, { status: 204 });
  }

  const threadId = request.headers.get("x-thread-id")?.trim() || "";
  if (!(await isAuthorizedForThread(request, threadId))) return json({ error: "Unauthorized" }, 401);

  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "";
  const fileName = decodeFileName(request.headers.get("x-file-name") || "media");
  const contentLength = Number(request.headers.get("content-length") || 0);

  if (!isMediaType(contentType)) {
    return json({ error: "Only image or video files can be uploaded" }, 415);
  }
  if (contentLength > MAX_FILE_SIZE) {
    return json({ error: "File exceeds the 25 MB limit" }, 413);
  }

  const content = await request.arrayBuffer();
  if (content.byteLength === 0) return json({ error: "File is empty" }, 400);
  if (content.byteLength > MAX_FILE_SIZE) return json({ error: "File exceeds the 25 MB limit" }, 413);

  const safeFileName = sanitizeFileName(fileName);
  const mediaKey = `${threadId}/${crypto.randomUUID()}/${contentType.replace("/", "~")}/${safeFileName}`;
  const mediaPath = `${ROUTE_PREFIX}/${mediaKey.split("/").map(encodeURIComponent).join("/")}`;
  await store.set(mediaKey, content);

  return json(
    {
      key: mediaKey,
      url: new URL(mediaPath, request.url).toString(),
      name: fileName.slice(0, 255),
      type: contentType,
    },
    201,
  );
};

export const config: Config = {
  path: [ROUTE_PREFIX, `${ROUTE_PREFIX}/*`],
};
