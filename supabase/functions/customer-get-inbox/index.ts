import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string) {
  const western = phone
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
  const cleaned = western.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned;
}

function phoneVariants(phone: string) {
  const normalized = normalizePhone(phone);
  const variants = new Set<string>([normalized]);
  if (/^9647\d{9}$/.test(normalized)) variants.add(`0${normalized.slice(3)}`);
  if (normalized) variants.add(`+${normalized}`);
  return [...variants].filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const customerPhone = normalizePhone(String(body.customer_phone || ""));
    const customerPhones = phoneVariants(customerPhone);
    const sessionToken = String(body.session_token || "");
    const { data: session } = await supabase.from("customer_web_sessions").select("customer_phone, expires_at").eq("session_token", sessionToken).maybeSingle();
    if (!session || normalizePhone(String(session.customer_phone || "")) !== customerPhone || new Date(session.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data, error } = await supabase
      .from("customer_notifications")
      .select("id,title,body,is_read,reference_booking_id,created_at")
      .in("customer_phone", customerPhones)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("id, booking_number, booking_date, booking_time, status, created_at, customer_rating, rated_at, stations(name), services(name)")
      .in("customer_phone", customerPhones)
      .order("created_at", { ascending: false })
      .limit(20);
    if (bookingsError) return new Response(JSON.stringify({ error: bookingsError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const visibleStatuses = new Set(["pending", "pending_owner_approval", "pending_customer_approval", "confirmed", "completed", "cancelled"]);
    const visibleBookings = (bookings || []).filter((booking) => visibleStatuses.has(String(booking.status || "")));

    return new Response(JSON.stringify({ success: true, notifications: data || [], bookings: visibleBookings }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
