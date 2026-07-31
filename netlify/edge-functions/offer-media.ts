import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/edge-functions";

const STORE_NAME = "offer-media";
const ROUTE_PREFIX = "/api/offer-media";
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

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
  const extension = key.split(".").pop()?.toLowerCase() || "";
  return MIME_TYPES_BY_EXTENSION[extension] || "application/octet-stream";
};

const isAdminRequest = async (request: Request) => {
  const authorization = request.headers.get("authorization");
  const supabaseUrl = Netlify.env.get("VITE_SUPABASE_URL");
  const publishableKey = Netlify.env.get("VITE_SUPABASE_PUBLISHABLE_KEY");

  if (!authorization?.startsWith("Bearer ") || !supabaseUrl || !publishableKey) return false;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/user_roles?select=role&role=eq.admin&limit=1`,
    {
      headers: {
        apikey: publishableKey,
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

  const contentType = request.headers.get("content-type")?.split(";")[0].trim() || "";
  const fileName = decodeFileName(request.headers.get("x-file-name") || "media");
  const contentLength = Number(request.headers.get("content-length") || 0);

  if (!ALLOWED_MEDIA_TYPES.has(contentType)) {
    return json({ error: "Only supported image and video files can be uploaded" }, 415);
  }
  if (contentLength > MAX_FILE_SIZE) {
    return json({ error: "File exceeds the 100 MB limit" }, 413);
  }

  const content = await request.arrayBuffer();
  if (content.byteLength === 0) return json({ error: "File is empty" }, 400);
  if (content.byteLength > MAX_FILE_SIZE) return json({ error: "File exceeds the 100 MB limit" }, 413);

  const safeFileName = sanitizeFileName(fileName);
  const mediaKey = `${crypto.randomUUID()}/${safeFileName}`;
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
