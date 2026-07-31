import { describe, expect, it } from "vitest";
import { formatMediaSize, getOfferMediaKind, resolveOfferMediaType } from "@/lib/offerMedia";

describe("offer media types", () => {
  it("keeps the browser type for any image or video", () => {
    expect(resolveOfferMediaType(new File([""], "a.avif", { type: "image/avif" }))).toBe("image/avif");
    expect(resolveOfferMediaType(new File([""], "a.ogv", { type: "video/ogg" }))).toBe("video/ogg");
  });

  it("resolves the type from the extension when the browser leaves it blank", () => {
    expect(resolveOfferMediaType(new File([""], "photo.HEIC", { type: "" }))).toBe("image/heic");
    expect(resolveOfferMediaType(new File([""], "clip.mkv", { type: "application/octet-stream" })))
      .toBe("video/x-matroska");
  });

  it("rejects files that are neither image nor video", () => {
    expect(resolveOfferMediaType(new File([""], "terms.pdf", { type: "application/pdf" }))).toBe("");
    expect(getOfferMediaKind("application/pdf", "terms.pdf")).toBeNull();
    expect(getOfferMediaKind("", "archive.zip")).toBeNull();
    expect(getOfferMediaKind(null, "notes")).toBeNull();
  });

  it("classifies media as image or video", () => {
    expect(getOfferMediaKind("image/svg+xml", "logo.svg")).toBe("image");
    expect(getOfferMediaKind("video/quicktime", "clip.mov")).toBe("video");
    expect(getOfferMediaKind(null, "clip.webm")).toBe("video");
  });

  it("formats media sizes", () => {
    expect(formatMediaSize(512)).toBe("512 B");
    expect(formatMediaSize(2048)).toBe("2.0 KB");
    expect(formatMediaSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
