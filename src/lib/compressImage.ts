// Phone photos are often 3–8 MB at 4000px wide, while the mobile app shows
// offers at well under 1600px. Re-encoding before upload cuts what every
// customer downloads by an order of magnitude.
const MAX_DIMENSION = 1600;
const QUALITY = 0.82;
const MIN_BYTES_TO_COMPRESS = 200 * 1024;

// Animated (gif/apng) and vector (svg) images would lose what makes them
// useful, and HEIC/TIFF can't be decoded by most browsers' canvas.
const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/bmp", "image/avif"]);

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Downscales and re-encodes an image as WebP (JPEG where WebP encoding is not
 * supported). Returns the original file whenever compression is not possible
 * or would not make it smaller.
 */
export const compressImage = async (file: File, type = file.type): Promise<File> => {
  if (!COMPRESSIBLE_TYPES.has(type) || typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < MIN_BYTES_TO_COMPRESS) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let blob = await canvasToBlob(canvas, "image/webp", QUALITY);
    // Safari before 17 silently falls back to PNG for unsupported types.
    if (!blob || blob.type !== "image/webp") {
      if (type === "image/png") return file; // keep transparency
      blob = await canvasToBlob(canvas, "image/jpeg", QUALITY);
    }
    if (!blob || blob.size >= file.size) return file;

    const extension = blob.type === "image/webp" ? "webp" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.${extension}`, { type: blob.type, lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
};
