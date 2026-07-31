import { supabase } from "@/integrations/supabase/client";

export type UploadedOfferMedia = {
  key: string;
  url: string;
  name: string;
  type: string;
};

export type OfferMediaKind = "image" | "video";

export const OFFER_MEDIA_ACCEPT = "image/*,video/*";
export const MAX_OFFER_MEDIA_SIZE = 100 * 1024 * 1024;

const IMAGE_EXTENSION_TYPES: Record<string, string> = {
  apng: "image/apng",
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  ico: "image/x-icon",
  jfif: "image/jpeg",
  jpe: "image/jpeg",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp",
};

const VIDEO_EXTENSION_TYPES: Record<string, string> = {
  "3gp": "video/3gpp",
  avi: "video/x-msvideo",
  flv: "video/x-flv",
  m4v: "video/x-m4v",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
  mp4: "video/mp4",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  ogv: "video/ogg",
  webm: "video/webm",
  wmv: "video/x-ms-wmv",
};

const getExtensionType = (fileName: string) => {
  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  return IMAGE_EXTENSION_TYPES[extension] || VIDEO_EXTENSION_TYPES[extension] || "";
};

/**
 * Resolves the media type of a picked file. Browsers leave `type` empty for less
 * common extensions (heic, mkv, …), so the file name is used as a fallback.
 */
export const resolveOfferMediaType = (file: File) => {
  if (file.type.startsWith("image/") || file.type.startsWith("video/")) return file.type;
  return getExtensionType(file.name);
};

export const getOfferMediaKind = (mediaType: string | null, fileName = ""): OfferMediaKind | null => {
  const type = mediaType?.startsWith("image/") || mediaType?.startsWith("video/")
    ? mediaType
    : getExtensionType(fileName);

  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  return null;
};

export const formatMediaSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getAccessToken = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error(error?.message || "Authentication is required");
  }
  return data.session.access_token;
};

const getErrorMessage = async (response: Response) => {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error || `Media request failed (${response.status})`;
};

export const uploadOfferMedia = async (file: File): Promise<UploadedOfferMedia> => {
  const mediaType = resolveOfferMediaType(file);
  if (!getOfferMediaKind(mediaType, file.name)) {
    throw new Error("Only image or video files can be uploaded");
  }

  const accessToken = await getAccessToken();
  const response = await fetch("/api/offer-media", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": mediaType,
      "X-File-Name": encodeURIComponent(file.name),
    },
    body: file,
  });

  if (!response.ok) throw new Error(await getErrorMessage(response));
  return await response.json() as UploadedOfferMedia;
};

export const deleteOfferMedia = async (key: string) => {
  if (!key) return;
  const accessToken = await getAccessToken();
  const response = await fetch(`/api/offer-media/${key.split("/").map(encodeURIComponent).join("/")}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok && response.status !== 404) throw new Error(await getErrorMessage(response));
};
