import { supabase } from "@/integrations/supabase/client";
import { getCustomerSession } from "@/lib/customerSession";
import { getOfferMediaKind, resolveOfferMediaType } from "@/lib/offerMedia";

export type UploadedChatMedia = {
  key: string;
  url: string;
  name: string;
  type: string;
};

export const CHAT_MEDIA_ACCEPT = "image/*,video/*";
export const MAX_CHAT_MEDIA_SIZE = 25 * 1024 * 1024;

const getErrorMessage = async (response: Response) => {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error || `Media request failed (${response.status})`;
};

/**
 * Chat has two kinds of senders with two different auth mechanisms (see
 * netlify/edge-functions/chat-media.ts): a Supabase Auth session for owners/
 * admins, or a phone-based customer session for customers. This picks
 * whichever one is actually signed in.
 */
const buildAuthHeaders = async (threadId: string): Promise<Record<string, string>> => {
  const { data } = await supabase.auth.getSession();
  const ownerAccessToken = data.session?.access_token;
  if (ownerAccessToken) {
    return { Authorization: `Bearer ${ownerAccessToken}`, "X-Thread-Id": threadId };
  }

  const customerSession = getCustomerSession();
  if (customerSession) {
    return {
      "X-Customer-Phone": customerSession.customerPhone,
      "X-Customer-Session-Token": customerSession.sessionToken,
      "X-Thread-Id": threadId,
    };
  }

  throw new Error("Authentication is required");
};

export const uploadChatMedia = async (threadId: string, file: File): Promise<UploadedChatMedia> => {
  const mediaType = resolveOfferMediaType(file);
  if (!getOfferMediaKind(mediaType, file.name)) {
    throw new Error("Only image or video files can be uploaded");
  }
  if (file.size > MAX_CHAT_MEDIA_SIZE) {
    throw new Error("File exceeds the 25 MB limit");
  }

  const authHeaders = await buildAuthHeaders(threadId);
  const response = await fetch("/api/chat-media", {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": mediaType,
      "X-File-Name": encodeURIComponent(file.name),
    },
    body: file,
  });

  if (!response.ok) throw new Error(await getErrorMessage(response));
  return await response.json() as UploadedChatMedia;
};

export const deleteChatMedia = async (threadId: string, key: string) => {
  if (!key) return;
  const authHeaders = await buildAuthHeaders(threadId);
  const response = await fetch(`/api/chat-media/${key.split("/").map(encodeURIComponent).join("/")}`, {
    method: "DELETE",
    headers: authHeaders,
  });

  if (!response.ok && response.status !== 404) throw new Error(await getErrorMessage(response));
};
