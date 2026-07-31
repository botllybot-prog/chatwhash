import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    // Unmount while the object URL stubs are still in place.
    cleanup();
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

  it("previews images and videos whose extension the browser did not type", () => {
    const { container, rerender } = render(
      <OfferMediaPreview
        file={new File(["image"], "offer.heic", { type: "" })}
        mediaUrl={null}
        mediaType={null}
        fileName="offer.heic"
        label="Review"
      />,
    );
    expect(container.querySelector("img")).toHaveAttribute("src", "blob:offer-preview");

    rerender(
      <OfferMediaPreview
        file={new File(["video"], "offer.mkv", { type: "" })}
        mediaUrl={null}
        mediaType={null}
        fileName="offer.mkv"
        label="Review"
      />,
    );
    expect(container.querySelector("video")).toHaveAttribute("src", "blob:offer-preview");
  });

  it("reviews the pending file with its kind, size and status, and can remove it", () => {
    const onRemove = vi.fn();
    render(
      <OfferMediaPreview
        file={new File(["a".repeat(2048)], "offer.png", { type: "image/png" })}
        mediaUrl={null}
        mediaType={null}
        fileName=""
        label="Review"
        kindLabels={{ image: "Image", video: "Video" }}
        statusLabels={{ pending: "Pending", stored: "Stored file" }}
        removeLabel="Remove file"
        onRemove={onRemove}
      />,
    );

    expect(screen.getByText("Image")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /remove file/i }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("shows an empty state when no media is attached", () => {
    render(
      <OfferMediaPreview
        file={null}
        mediaUrl={null}
        mediaType={null}
        fileName=""
        label="Review"
        emptyLabel="No file"
      />,
    );

    expect(screen.getByText("No file")).toBeInTheDocument();
  });
});
