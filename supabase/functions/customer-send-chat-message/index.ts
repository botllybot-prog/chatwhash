import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_BODY_LENGTH = 4000;

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

async function seedDirectThreadOwners(supabase: ReturnType<typeof createClient>, threadId: string, stationId: string) {
  const { data: owners } = await supabase
    .from("station_owners")
    .select("user_id")
    .eq("station_id", stationId);

  const rows = (owners || [])
    .filter((owner: any) => owner.user_id)
    .map((owner: any) => ({ thread_id: threadId, user_id: owner.user_id }));

  if (rows.length > 0) {
    await supabase.from("chat_thread_members").upsert(rows, { onConflict: "thread_id,user_id" });
  }
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
    const stationId = String(body.station_id || "").trim();
    const messageBody = String(body.body || "").trim();
    const mediaKey = String(body.media_key || "").trim();
    const mediaUrl = String(body.media_url || "").trim();
    const mediaType = String(body.media_type || "").trim();
    const mediaName = String(body.media_name || "").trim();

    if (!customerPhone || !sessionToken || (!threadId && !stationId)) {
      return json({ error: "Missing required fields" }, 400);
    }
    if (!messageBody && !mediaUrl) {
      return json({ error: "Message body or media is required" }, 400);
    }
    if (messageBody.length > MAX_BODY_LENGTH) {
      return json({ error: "Message is too long" }, 413);
    }

    const { data: session } = await supabase
      .from("customer_web_sessions")
      .select("customer_phone, customer_name, expires_at")
      .eq("session_token", sessionToken)
      .maybeSingle();

    if (!session || normalizePhone(String(session.customer_phone || "")) !== customerPhone || new Date(session.expires_at).getTime() < Date.now()) {
      return json({ error: "Invalid session" }, 401);
    }

    const { data: profile } = await supabase
      .from("customer_profiles")
      .select("is_blocked")
      .eq("customer_phone", customerPhone)
      .maybeSingle();

    if (profile?.is_blocked) {
      return json({ error: "Your account is blocked from sending messages" }, 403);
    }

    let resolvedThreadId = threadId;

    if (resolvedThreadId) {
      const { data: member } = await supabase
        .from("chat_thread_members")
        .select("id")
        .eq("thread_id", resolvedThreadId)
        .eq("customer_phone", customerPhone)
        .maybeSingle();

      if (!member) return json({ error: "You are not a member of this thread" }, 403);
    } else {
      const { data: station } = await supabase.from("stations").select("id").eq("id", stationId).maybeSingle();
      if (!station) return json({ error: "Station not found" }, 404);

      const { data: existingThread } = await supabase
        .from("chat_threads")
        .select("id")
        .eq("kind", "direct")
        .eq("station_id", stationId)
        .maybeSingle();

      if (existingThread) {
        resolvedThreadId = existingThread.id;
      } else {
        const { data: newThread, error: createError } = await supabase
          .from("chat_threads")
          .insert({ kind: "direct", station_id: stationId })
          .select("id")
          .single();

        if (createError) return json({ error: createError.message }, 500);
        resolvedThreadId = newThread.id;
        await seedDirectThreadOwners(supabase, resolvedThreadId, stationId);
      }

      await supabase
        .from("chat_thread_members")
        .upsert({ thread_id: resolvedThreadId, customer_phone: customerPhone }, { onConflict: "thread_id,customer_phone" });
    }

    const { data: message, error: messageError } = await supabase
      .from("chat_messages")
      .insert({
        thread_id: resolvedThreadId,
        sender_type: "customer",
        sender_id: customerPhone,
        sender_name: session.customer_name || null,
        body: messageBody || null,
        media_key: mediaKey || null,
        media_url: mediaUrl || null,
        media_type: mediaType || null,
        media_name: mediaName || null,
      })
      .select("id, thread_id, sender_type, sender_id, sender_name, body, media_key, media_url, media_type, media_name, created_at")
      .single();

    if (messageError) return json({ error: messageError.message }, 500);

    await supabase.from("chat_threads").update({ last_message_at: message.created_at }).eq("id", resolvedThreadId);

    // Notification fan-out (both directions) is handled uniformly by the
    // trg_notify_chat_message_edge_function DB trigger -> notify-on-chat-message,
    // the same pattern used for booking notifications -- this keeps owner-sent
    // messages (inserted directly via RLS, not through an edge function) covered
    // by the same code path instead of duplicating notification logic here.

    return json({ success: true, thread_id: resolvedThreadId, message });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
