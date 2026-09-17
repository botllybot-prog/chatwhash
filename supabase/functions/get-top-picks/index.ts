import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SEARCH_WINDOW_DAYS = 30;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

type StationRow = {
  id: string;
  name: string;
  address: string | null;
  detailed_address: string | null;
  category: string;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
  working_hours_start: string;
  working_hours_end: string;
  scheduling_type: string;
  slot_duration_minutes: number;
  rating_average: number;
  rating_count: number;
  is_boosted: boolean;
  boost_priority: number;
};

type ServiceRow = {
  id: string;
  name: string;
  price: number;
  station_id: string | null;
  is_boosted: boolean;
  boost_priority: number;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function rank<T extends { is_boosted: boolean; boost_priority: number }>(
  rows: T[],
  countById: Map<string, number>,
  idOf: (row: T) => string,
  limit: number,
) {
  return [...rows]
    .sort((a, b) => {
      if (a.is_boosted !== b.is_boosted) return a.is_boosted ? -1 : 1;
      if (a.is_boosted && b.is_boosted && a.boost_priority !== b.boost_priority) {
        return b.boost_priority - a.boost_priority;
      }
      const countA = countById.get(idOf(a)) || 0;
      const countB = countById.get(idOf(b)) || 0;
      return countB - countA;
    })
    .slice(0, limit)
    .map((row) => ({ ...row, search_count: countById.get(idOf(row)) || 0 }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ success: false, error: "Method not allowed" }, 405);

  try {
    const url = new URL(req.url);
    const requestedLimit = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(Math.floor(requestedLimit), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const since = new Date(Date.now() - SEARCH_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const [stationsResult, servicesResult, eventsResult] = await Promise.all([
      supabase
        .from("stations")
        .select(
          "id, name, address, detailed_address, category, image_url, latitude, longitude, working_hours_start, working_hours_end, scheduling_type, slot_duration_minutes, rating_average, rating_count, is_boosted, boost_priority",
        )
        .eq("is_active", true),
      supabase
        .from("services")
        .select("id, name, price, station_id, is_boosted, boost_priority")
        .eq("is_active", true),
      supabase
        .from("search_events")
        .select("station_id, service_id")
        .gte("created_at", since),
    ]);

    if (stationsResult.error) return json({ success: false, error: stationsResult.error.message }, 500);
    if (servicesResult.error) return json({ success: false, error: servicesResult.error.message }, 500);
    if (eventsResult.error) return json({ success: false, error: eventsResult.error.message }, 500);

    const stationCounts = new Map<string, number>();
    const serviceCounts = new Map<string, number>();
    for (const event of eventsResult.data || []) {
      if (event.station_id) stationCounts.set(event.station_id, (stationCounts.get(event.station_id) || 0) + 1);
      if (event.service_id) serviceCounts.set(event.service_id, (serviceCounts.get(event.service_id) || 0) + 1);
    }

    const stations = rank(stationsResult.data as StationRow[], stationCounts, (s) => s.id, limit);

    const stationNameById = new Map((stationsResult.data as StationRow[]).map((s) => [s.id, s.name]));
    const servicesWithStation = (servicesResult.data as ServiceRow[]).map((service) => ({
      ...service,
      station_name: service.station_id ? stationNameById.get(service.station_id) || null : null,
    }));
    const services = rank(servicesWithStation, serviceCounts, (s) => s.id, limit);

    return json({ success: true, stations, services });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Internal error" }, 500);
  }
});
