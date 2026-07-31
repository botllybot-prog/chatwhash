import { supabase } from "@/integrations/supabase/client";

export type UploadedOfferMedia = {
  key: string;
  url: string;
  name: string;
  type: string;
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
  const accessToken = await getAccessToken();
  const response = await fetch("/api/offer-media", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": file.type,
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
