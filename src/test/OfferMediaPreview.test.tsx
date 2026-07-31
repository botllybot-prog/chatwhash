import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OfferMediaPreview from "@/components/admin/OfferMediaPreview";

describe("OfferMediaPreview", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:offer-preview"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a persisted image above the file field", () => {
    render(
      <OfferMediaPreview
        file={null}
        mediaUrl="https://example.test/offer.webp"
        mediaType="image/webp"
        fileName="offer.webp"
        label="Selected file"
      />,
    );

    expect(screen.getByRole("img", { name: "offer.webp" })).toHaveAttribute(
      "src",
      "https://example.test/offer.webp",
    );
    expect(screen.getByRole("link", { name: /offer.webp/i })).toHaveAttribute(
      "href",
      "https://example.test/offer.webp",
    );
  });

  it("shows a newly selected video immediately and releases its local URL", () => {
    const file = new File(["video"], "offer.mp4", { type: "video/mp4" });
    const { container, unmount } = render(
      <OfferMediaPreview
        file={file}
        mediaUrl={null}
        mediaType={null}
        fileName="offer.mp4"
        label="Selected file"
      />,
    );

    const video = container.querySelector("video");
    expect(video).toHaveAttribute("src", "blob:offer-preview");
    fireEvent.loadedMetadata(video as HTMLVideoElement);
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:offer-preview");
  });
});
