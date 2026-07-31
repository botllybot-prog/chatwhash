import { beforeEach, describe, expect, it, vi } from "vitest";

const blobMocks = vi.hoisted(() => ({
  set: vi.fn(),
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
});
