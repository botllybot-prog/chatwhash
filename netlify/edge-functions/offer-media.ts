import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/edge-functions";

const STORE_NAME = "offer-media";
const ROUTE_PREFIX = "/api/offer-media";
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MEDIA_TYPE_PATTERN = /^(image|video)\/[a-z0-9][a-z0-9.+-]*$/;

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
  // Keys are stored as `<id>/<media~type>/<file name>` so any image or video
  // type can be served back with the exact type it was uploaded with.
  const segments = key.split("/");
  if (segments.length >= 3) {
    const declared = segments[1].replace("~", "/").toLowerCase();
    if (isMediaType(declared)) return declared;
  }

  const extension = key.split(".").pop()?.toLowerCase() || "";
  return MIME_TYPES_BY_EXTENSION[extension] || "application/octet-stream";
};

// The browser bundle already falls back to these values (see
// src/integrations/supabase/client.ts), so the edge function does the same.
// Without a fallback every upload is rejected on sites that do not define the
// Supabase variables in their environment.
const FALLBACK_SUPABASE_URL = "https://yhklvtzonvgzkodysawu.supabase.co";

const readEnv = (...names: string[]) => {
  for (const name of names) {
    const value = Netlify.env.get(name)?.trim();
    if (value) return value;
  }
  return "";
};

const isAdminRequest = async (request: Request) => {
  const authorization = request.headers.get("authorization");
  const supabaseUrl = readEnv("VITE_SUPABASE_URL", "SUPABASE_URL") || FALLBACK_SUPABASE_URL;
  const publishableKey = readEnv(
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
  );

  if (!authorization?.startsWith("Bearer ") || !supabaseUrl) return false;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/user_roles?select=role&role=eq.admin&limit=1`,
    {
      headers: {
        // Supabase accepts the caller's signed token as the API key, which keeps
        // the check working when no publishable key is configured.
        apikey: publishableKey || authorization.slice("Bearer ".length).trim(),
        Authorization: authorization,
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) return false;
  const roles = (await response.json()) as Array<{ role?: string }>;
  return roles.some((entry) => entry.role === "admin");
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

  if (!(await isAdminRequest(request))) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (request.method === "DELETE") {
    if (!key) return json({ error: "Media key is required" }, 400);
    await store.delete(key);
    return new Response(null, { status: 204 });
  }

  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "";
  const fileName = decodeFileName(request.headers.get("x-file-name") || "media");
  const contentLength = Number(request.headers.get("content-length") || 0);

  if (!isMediaType(contentType)) {
    return json({ error: "Only image or video files can be uploaded" }, 415);
  }
  if (contentLength > MAX_FILE_SIZE) {
    return json({ error: "File exceeds the 100 MB limit" }, 413);
  }

  const content = await request.arrayBuffer();
  if (content.byteLength === 0) return json({ error: "File is empty" }, 400);
  if (content.byteLength > MAX_FILE_SIZE) return json({ error: "File exceeds the 100 MB limit" }, 413);

  const safeFileName = sanitizeFileName(fileName);
  const mediaKey = `${crypto.randomUUID()}/${contentType.replace("/", "~")}/${safeFileName}`;
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
