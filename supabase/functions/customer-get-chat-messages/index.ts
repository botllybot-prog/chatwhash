import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MESSAGE_PAGE_SIZE = 100;

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
    const threadId = String(body.thread_id || "").trim();

    if (!customerPhone || !sessionToken || !threadId) return json({ error: "Missing required fields" }, 400);

    const { data: session } = await supabase
      .from("customer_web_sessions")
      .select("customer_phone, expires_at")
      .eq("session_token", sessionToken)
      .maybeSingle();

    if (!session || normalizePhone(String(session.customer_phone || "")) !== customerPhone || new Date(session.expires_at).getTime() < Date.now()) {
      return json({ error: "Invalid session" }, 401);
    }

    const { data: member } = await supabase
      .from("chat_thread_members")
      .select("id")
      .eq("thread_id", threadId)
      .eq("customer_phone", customerPhone)
      .maybeSingle();

    if (!member) return json({ error: "You are not a member of this thread" }, 403);

    const { data: messages, error: messagesError } = await supabase
      .from("chat_messages")
      .select("id, thread_id, sender_type, sender_id, body, media_key, media_url, media_type, media_name, created_at, read_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(MESSAGE_PAGE_SIZE);

    if (messagesError) return json({ error: messagesError.message }, 500);

    await supabase
      .from("chat_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("thread_id", threadId)
      .neq("sender_type", "customer")
      .is("read_at", null);

    return json({ success: true, messages: messages || [] });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
