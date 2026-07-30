import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-customer-session-token",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

type OfferRow = {
  id: string;
  title: string;
  type: string;
  cities: string;
};

type OfferTypeRow = {
  id: string;
  name: string;
};

type OfferDetailRow = {
  id: string;
  offer_id: string;
  title: string | null;
  body: string | null;
  url_type: string;
  url: string | null;
  station_id: string | null;
  sort: number;
  media_key: string | null;
  media_url: string | null;
  media_type: string | null;
  media_name: string | null;
};

type StationRow = {
  id: string;
  name: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseCities(value: string) {
  const seen = new Set<string>();
  return value
    .split(",")
    .map((city) => city.trim())
    .filter((city) => {
      if (!city) return false;
      const key = city.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function citiesMatch(offerCities: string[], customerCity: string | null) {
  const normalizedCities = offerCities.map((city) => city.toLowerCase());
  if (normalizedCities.includes("all")) return true;
  if (!customerCity) return false;
  return normalizedCities.includes(customerCity.trim().toLowerCase());
}

function bearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

async function getCustomerCity(req: Request, supabase: ReturnType<typeof createClient>) {
  const sessionToken = req.headers.get("x-customer-session-token") || bearerToken(req);
  if (!sessionToken) return null;

  const { data: session } = await supabase
    .from("customer_web_sessions")
    .select("customer_phone, expires_at")
    .eq("session_token", sessionToken)
    .maybeSingle();

  if (session && new Date(String(session.expires_at)).getTime() >= Date.now()) {
    const { data: profile } = await supabase
      .from("customer_profiles")
      .select("city")
      .eq("customer_phone", String(session.customer_phone))
      .maybeSingle();
    return String(profile?.city || "").trim() || null;
  }

  const publicClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${sessionToken}` } } },
  );
  const { data: authData } = await publicClient.auth.getUser();
  const metadataCity = authData.user?.user_metadata?.city || authData.user?.app_metadata?.city;
  return typeof metadataCity === "string" && metadataCity.trim() ? metadataCity.trim() : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ success: false, error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const customerCity = await getCustomerCity(req, supabase);
    const { data: offers, error: offersError } = await supabase
      .from("offers")
      .select("id, title, type, cities")
      .order("title", { ascending: true });

    if (offersError) return json({ success: false, error: offersError.message }, 500);

    const typedOffers = (offers || []) as OfferRow[];
    const visibleOffers = typedOffers.filter((offer) => citiesMatch(parseCities(offer.cities), customerCity));
    const offerIds = visibleOffers.map((offer) => offer.id);
    const typeIds = [...new Set(visibleOffers.map((offer) => offer.type).filter(Boolean))];

    const [typesResult, detailsResult] = await Promise.all([
      typeIds.length
        ? supabase.from("offer_types").select("id, name").in("id", typeIds)
        : Promise.resolve({ data: [], error: null }),
      offerIds.length
        ? supabase
            .from("offer_details")
            .select("id, offer_id, title, body, url_type, url, station_id, sort, media_key, media_url, media_type, media_name")
            .in("offer_id", offerIds)
            .order("sort", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (typesResult.error) return json({ success: false, error: typesResult.error.message }, 500);
    if (detailsResult.error) return json({ success: false, error: detailsResult.error.message }, 500);

    const details = (detailsResult.data || []) as OfferDetailRow[];
    const stationIds = [...new Set(details.map((detail) => detail.station_id).filter(Boolean))] as string[];
    const stationsResult = stationIds.length
      ? await supabase.from("stations").select("id, name").in("id", stationIds)
      : { data: [], error: null };

    if (stationsResult.error) return json({ success: false, error: stationsResult.error.message }, 500);

    const typeById = new Map((typesResult.data || []).map((row: OfferTypeRow) => [row.id, row]));
    const stationById = new Map((stationsResult.data || []).map((row: StationRow) => [row.id, row]));
    const detailsByOfferId = new Map<string, OfferDetailRow[]>();

    for (const detail of details) {
      const current = detailsByOfferId.get(detail.offer_id) || [];
      current.push(detail);
      detailsByOfferId.set(detail.offer_id, current);
    }

    const data = visibleOffers.map((offer) => ({
      id: offer.id,
      title: offer.title,
      type: typeById.get(offer.type) || { id: offer.type, name: null },
      cities: parseCities(offer.cities),
      details: (detailsByOfferId.get(offer.id) || []).map((detail) => ({
        id: detail.id,
        title: detail.title,
        body: detail.body,
        url_type: detail.url_type,
        url: detail.url,
        station: detail.station_id ? stationById.get(detail.station_id) || null : null,
        sort: detail.sort,
        media: detail.media_url
          ? {
              url: detail.media_url,
              type: detail.media_type,
              name: detail.media_name,
            }
          : null,
      })),
    }));

    return json({ success: true, data });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Internal error" }, 500);
  }
});
