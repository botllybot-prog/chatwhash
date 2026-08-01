import { supabase } from "@/integrations/supabase/client";

export type OfferMediaIndexEntry = {
  key: string;
  url: string;
  type: string;
  name: string;
};

/** Media metadata of one offer, keyed by the sort position of its detail. */
export type OfferMediaIndex = Record<string, OfferMediaIndexEntry>;

const ROUTE_PREFIX = "/api/offer-media-index";

const getAccessToken = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error(error?.message || "Authentication is required");
  }
  return data.session.access_token;
};

const getErrorMessage = async (response: Response) => {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error || `Media metadata request failed (${response.status})`;
};

const indexUrl = (offerId: string) => `${ROUTE_PREFIX}/${encodeURIComponent(offerId)}`;

/**
 * Reads the stored media of an offer. A missing or unreadable record resolves to
 * an empty index so the offer stays editable.
 */
export const fetchOfferMediaIndex = async (offerId: string): Promise<OfferMediaIndex> => {
  if (!offerId) return {};

  try {
    const response = await fetch(indexUrl(offerId), { headers: { Accept: "application/json" } });
    if (!response.ok) return {};
    const body = await response.json() as { entries?: OfferMediaIndex } | null;
    return body?.entries || {};
  } catch {
    return {};
  }
};

/** Replaces the media of an offer with the given entries. */
export const saveOfferMediaIndex = async (offerId: string, entries: OfferMediaIndex) => {
  const accessToken = await getAccessToken();
  const response = await fetch(indexUrl(offerId), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ entries }),
  });

  if (!response.ok) throw new Error(await getErrorMessage(response));
};

export const deleteOfferMediaIndex = async (offerId: string) => {
  if (!offerId) return;
  const accessToken = await getAccessToken();
  const response = await fetch(indexUrl(offerId), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok && response.status !== 404) throw new Error(await getErrorMessage(response));
};

export const collectOfferMediaKeys = (index: OfferMediaIndex) =>
  Object.values(index)
    .map((entry) => entry.key)
    .filter(Boolean);
