import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const searchType = body?.search_type;
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    const stationId = typeof body?.station_id === "string" ? body.station_id : null;
    const serviceId = typeof body?.service_id === "string" ? body.service_id : null;
    const customerPhone = typeof body?.customer_phone === "string" ? body.customer_phone : null;

    if (searchType !== "station" && searchType !== "service") {
      return json({ success: false, error: "search_type must be 'station' or 'service'" }, 400);
    }
    if (query.length < MIN_QUERY_LENGTH) {
      return json({ success: false, error: "query too short" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await supabase.from("search_events").insert({
      search_type: searchType,
      query: query.slice(0, MAX_QUERY_LENGTH),
      station_id: stationId,
      service_id: serviceId,
      customer_phone: customerPhone,
    });

    if (error) return json({ success: false, error: error.message }, 500);

    return json({ success: true });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Internal error" }, 500);
  }
});
