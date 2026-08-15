import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(phone: string) {
  const western = String(phone || "")
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));
  const cleaned = western.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const customerPhone = normalizePhone(String(body.customer_phone || "").trim());
    const sessionToken = String(body.session_token || "").trim();

    if (!customerPhone || !sessionToken) return json({ error: "Missing required fields" }, 400);

    const { data: session } = await supabase
      .from("customer_web_sessions")
      .select("customer_phone, expires_at")
      .eq("session_token", sessionToken)
      .maybeSingle();

    if (!session || normalizePhone(String(session.customer_phone || "")) !== customerPhone || new Date(session.expires_at).getTime() < Date.now()) {
      return json({ error: "Invalid session" }, 401);
    }

    const { data: memberships, error: membershipsError } = await supabase
      .from("chat_thread_members")
      .select("thread_id")
      .eq("customer_phone", customerPhone);

    if (membershipsError) return json({ error: membershipsError.message }, 500);

    const threadIds = (memberships || []).map((row: any) => row.thread_id);
    if (threadIds.length === 0) return json({ success: true, threads: [] });

    const { data: threads, error: threadsError } = await supabase
      .from("chat_threads")
      .select("id, kind, name, station_id, last_message_at, created_at, stations(name)")
      .in("id", threadIds)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (threadsError) return json({ error: threadsError.message }, 500);

    const threadsWithUnread = await Promise.all(
      (threads || []).map(async (thread: any) => {
        const { count } = await supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("thread_id", thread.id)
          .neq("sender_type", "customer")
          .is("read_at", null);

        return {
          id: thread.id,
          kind: thread.kind,
          station_id: thread.station_id,
          title: thread.kind === "direct" ? thread.stations?.name || "المحطة" : thread.name || "مجموعة",
          last_message_at: thread.last_message_at,
          created_at: thread.created_at,
          unread_count: count || 0,
        };
      }),
    );

    return json({ success: true, threads: threadsWithUnread });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
