import { beforeEach, describe, expect, it, vi } from "vitest";

const blobMocks = vi.hoisted(() => ({
  set: vi.fn(),
  setJSON: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@netlify/blobs", () => ({
  getStore: vi.fn(() => blobMocks),
}));

import offerMediaHandler from "../../netlify/edge-functions/offer-media";

describe("offer media edge function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("Netlify", {
      env: {
        get: (name: string) => {
          if (name === "VITE_SUPABASE_URL") return "https://project.example.test";
          if (name === "VITE_SUPABASE_PUBLISHABLE_KEY") return "public-test-key";
          return undefined;
        },
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([{ role: "admin" }])));
  });

  it("stores an authenticated image and returns its public URL", async () => {
    const request = new Request("https://preview.example.test/api/offer-media", {
      method: "POST",
      headers: {
        Authorization: "Bearer admin-session",
        "Content-Type": "image/webp",
        "X-File-Name": encodeURIComponent("summer offer.webp"),
      },
      body: new Blob(["image-binary"], { type: "image/webp" }),
    });

    const response = await offerMediaHandler(request, {} as never);
    const body = await response.json() as { key: string; url: string; name: string; type: string };

    expect(response.status).toBe(201);
    expect(blobMocks.set).toHaveBeenCalledOnce();
    expect(blobMocks.set.mock.calls[0][0]).toMatch(/^[a-f0-9-]+\/image~webp\/summer-offer\.webp$/);
    expect(blobMocks.set.mock.calls[0][1]).toBeInstanceOf(ArrayBuffer);
    expect(body.url).toBe(`https://preview.example.test/api/offer-media/${body.key}`);
    expect(body.name).toBe("summer offer.webp");
    expect(body.type).toBe("image/webp");
  });

  it("accepts image and video types beyond the common extensions", async () => {
    for (const mediaType of ["image/heic", "video/x-matroska"]) {
      const request = new Request("https://preview.example.test/api/offer-media", {
        method: "POST",
        headers: {
          Authorization: "Bearer admin-session",
          "Content-Type": mediaType,
          "X-File-Name": "offer",
        },
        body: new Blob(["media-binary"], { type: mediaType }),
      });

      const response = await offerMediaHandler(request, {} as never);
      const body = await response.json() as { type: string };

      expect(response.status).toBe(201);
      expect(body.type).toBe(mediaType);
    }
  });

  it("rejects uploads that are neither image nor video", async () => {
    const request = new Request("https://preview.example.test/api/offer-media", {
      method: "POST",
      headers: {
        Authorization: "Bearer admin-session",
        "Content-Type": "application/pdf",
        "X-File-Name": "offer.pdf",
      },
      body: new Blob(["pdf-binary"], { type: "application/pdf" }),
    });

    const response = await offerMediaHandler(request, {} as never);

    expect(response.status).toBe(415);
    expect(blobMocks.set).not.toHaveBeenCalled();
  });

  it("serves stored media with the type it was uploaded with", async () => {
    blobMocks.get.mockResolvedValueOnce(new ReadableStream());
    const request = new Request(
      "https://preview.example.test/api/offer-media/abc-123/video~x-matroska/offer.mkv",
    );

    const response = await offerMediaHandler(request, {} as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("video/x-matroska");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Security-Policy")).toContain("sandbox");
  });

  it("falls back to the file extension for media stored before typed keys", async () => {
    blobMocks.get.mockResolvedValueOnce(new ReadableStream());
    const request = new Request("https://preview.example.test/api/offer-media/abc-123/offer.webp");

    const response = await offerMediaHandler(request, {} as never);

    expect(response.headers.get("Content-Type")).toBe("image/webp");
  });

  it("rejects uploads without an admin session", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([]));
    const request = new Request("https://preview.example.test/api/offer-media", {
      method: "POST",
      headers: {
        Authorization: "Bearer non-admin-session",
        "Content-Type": "video/mp4",
        "X-File-Name": "offer.mp4",
      },
      body: new Blob(["video-binary"], { type: "video/mp4" }),
    });

    const response = await offerMediaHandler(request, {} as never);

    expect(response.status).toBe(401);
    expect(blobMocks.set).not.toHaveBeenCalled();
  });

  it("still authorizes when the site defines no Supabase variables", async () => {
    vi.stubGlobal("Netlify", { env: { get: () => undefined } });
    const request = new Request("https://preview.example.test/api/offer-media", {
      method: "POST",
      headers: {
        Authorization: "Bearer admin-session",
        "Content-Type": "image/png",
        "X-File-Name": "offer.png",
      },
      body: new Blob(["image-binary"], { type: "image/png" }),
    });

    const response = await offerMediaHandler(request, {} as never);
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];

    expect(response.status).toBe(201);
    expect(url).toContain("/rest/v1/user_roles");
    // The caller's own token stands in for the missing publishable key.
    expect((init.headers as Record<string, string>).apikey).toBe("admin-session");
  });
  it("accepts the unprefixed Supabase variable names", async () => {
    vi.stubGlobal("Netlify", {
      env: {
        get: (name: string) => {
          if (name === "SUPABASE_URL") return "https://unprefixed.example.test";
          if (name === "SUPABASE_ANON_KEY") return "unprefixed-key";
          return undefined;
        },
      },
    });
    const request = new Request("https://preview.example.test/api/offer-media", {
      method: "POST",
      headers: {
        Authorization: "Bearer admin-session",
        "Content-Type": "image/png",
        "X-File-Name": "offer.png",
      },
      body: new Blob(["image-binary"], { type: "image/png" }),
    });

    const response = await offerMediaHandler(request, {} as never);
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];

    expect(response.status).toBe(201);
    expect(url).toContain("https://unprefixed.example.test/rest/v1/user_roles");
    expect((init.headers as Record<string, string>).apikey).toBe("unprefixed-key");
  });

  describe("offer media index", () => {
    const OFFER_ID = "11111111-2222-3333-4444-555555555555";
    const INDEX_URL = `https://preview.example.test/api/offer-media-index/${OFFER_ID}`;
    const entry = {
      key: "abc-123/image~webp/offer.webp",
      url: "https://preview.example.test/api/offer-media/abc-123/image~webp/offer.webp",
      type: "image/webp",
      name: "offer.webp",
    };

    it("stores the media of an offer for an admin", async () => {
      const request = new Request(INDEX_URL, {
        method: "PUT",
        headers: { Authorization: "Bearer admin-session", "Content-Type": "application/json" },
        body: JSON.stringify({ entries: { 1: entry } }),
      });

      const response = await offerMediaHandler(request, {} as never);
      const body = await response.json() as { entries: Record<string, typeof entry> };

      expect(response.status).toBe(200);
      expect(blobMocks.setJSON).toHaveBeenCalledWith(OFFER_ID, { 1: entry });
      expect(body.entries["1"]).toEqual(entry);
    });

    it("reads the media of an offer without a session", async () => {
      blobMocks.get.mockResolvedValueOnce({ 1: entry });
      const response = await offerMediaHandler(new Request(INDEX_URL), {} as never);
      const body = await response.json() as { entries: Record<string, typeof entry> };

      expect(response.status).toBe(200);
      expect(body.entries["1"]).toEqual(entry);
      expect(fetch).not.toHaveBeenCalled();
    });

    it("returns an empty index for an offer that has no media", async () => {
      blobMocks.get.mockResolvedValueOnce(null);
      const response = await offerMediaHandler(new Request(INDEX_URL), {} as never);
      const body = await response.json() as { entries: Record<string, unknown> };

      expect(response.status).toBe(200);
      expect(body.entries).toEqual({});
    });

    it("clears the record when an offer keeps no media", async () => {
      const request = new Request(INDEX_URL, {
        method: "PUT",
        headers: { Authorization: "Bearer admin-session", "Content-Type": "application/json" },
        body: JSON.stringify({ entries: {} }),
      });

      const response = await offerMediaHandler(request, {} as never);

      expect(response.status).toBe(200);
      expect(blobMocks.delete).toHaveBeenCalledWith(OFFER_ID);
      expect(blobMocks.setJSON).not.toHaveBeenCalled();
    });

    it("rejects entries that do not describe stored media", async () => {
      const invalidEntries = [
        { 1: { ...entry, type: "application/pdf" } },
        { 1: { ...entry, key: "" } },
        { 0: entry },
        { first: entry },
      ];

      for (const entries of invalidEntries) {
        const request = new Request(INDEX_URL, {
          method: "PUT",
          headers: { Authorization: "Bearer admin-session", "Content-Type": "application/json" },
          body: JSON.stringify({ entries }),
        });

        expect((await offerMediaHandler(request, {} as never)).status).toBe(400);
      }

      expect(blobMocks.setJSON).not.toHaveBeenCalled();
    });

    it("rejects writes without an admin session", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(Response.json([]));
      const request = new Request(INDEX_URL, {
        method: "PUT",
        headers: { Authorization: "Bearer non-admin-session", "Content-Type": "application/json" },
        body: JSON.stringify({ entries: { 1: entry } }),
      });

      const response = await offerMediaHandler(request, {} as never);

      expect(response.status).toBe(401);
      expect(blobMocks.setJSON).not.toHaveBeenCalled();
    });

    it("deletes the record of an offer for an admin", async () => {
      const request = new Request(INDEX_URL, {
        method: "DELETE",
        headers: { Authorization: "Bearer admin-session" },
      });

      const response = await offerMediaHandler(request, {} as never);

      expect(response.status).toBe(204);
      expect(blobMocks.delete).toHaveBeenCalledWith(OFFER_ID);
    });

    it("rejects a request without a valid offer id", async () => {
      const response = await offerMediaHandler(
        new Request("https://preview.example.test/api/offer-media-index/not-an-offer"),
        {} as never,
      );

      expect(response.status).toBe(400);
      expect(blobMocks.get).not.toHaveBeenCalled();
    });
  });
});
