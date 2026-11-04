/**
 * Small helpers for caching read-only edge function responses.
 *
 * - `memoize` keeps a value in the warm isolate for `ttlMs`, so repeated calls
 *   within that window skip the database. Concurrent callers share one load.
 * - `cachedJson` adds an ETag and answers `304 Not Modified` when the client
 *   already holds the same body, which saves the download on slow networks.
 */

type Entry<T> = { value: T; expiresAt: number };

export function memoize<T>(ttlMs: number, load: (key: string) => Promise<T>) {
  const values = new Map<string, Entry<T>>();
  const pending = new Map<string, Promise<T>>();

  return async (key = "") => {
    const hit = values.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;

    const inFlight = pending.get(key);
    if (inFlight) return inFlight;

    const promise = load(key)
      .then((value) => {
        values.set(key, { value, expiresAt: Date.now() + ttlMs });
        return value;
      })
      .finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  };
}

async function hashBody(body: string) {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(body));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function cachedJson(
  req: Request,
  body: unknown,
  headers: Record<string, string>,
  cacheControl: string,
) {
  const text = JSON.stringify(body);
  const etag = `"${await hashBody(text)}"`;
  const responseHeaders = { ...headers, "Cache-Control": cacheControl, ETag: etag };

  const ifNoneMatch = req.headers.get("if-none-match") || "";
  if (ifNoneMatch.split(",").some((tag) => tag.trim().replace(/^W\//, "") === etag)) {
    return new Response(null, { status: 304, headers: responseHeaders });
  }

  return new Response(text, {
    status: 200,
    headers: { ...responseHeaders, "Content-Type": "application/json" },
  });
}
