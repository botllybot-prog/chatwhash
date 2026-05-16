import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  const cleaned = String(phone || "").replace(/^\+/, "").replace(/\s+/g, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned;
}

async function loadVerifyToken(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "WHATSAPP_VERIFY_TOKEN")
    .maybeSingle();
  return data?.value || Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "";
}

async function saveInboundAudit(supabase: ReturnType<typeof createClient>, payload: any) {
  const entries = payload?.entry || [];
  for (const entry of entries) {
    const changes = entry?.changes || [];
    for (const change of changes) {
      const value = change?.value || {};
      const messages = value?.messages || [];
      for (const message of messages) {
        const phone = normalizePhone(message?.from || "");
        if (!phone) continue;

        let conversationId: string | null = null;
        const { data: existing } = await supabase
          .from("conversations")
          .select("id")
          .eq("customer_phone", phone)
          .maybeSingle();

        if (existing?.id) {
          conversationId = existing.id;
          await supabase
            .from("conversations")
            .update({ last_message_at: new Date().toISOString(), status: "open" })
            .eq("id", existing.id);
        } else {
          const { data: created } = await supabase
            .from("conversations")
            .insert({ customer_phone: phone, status: "open", last_message_at: new Date().toISOString() })
            .select("id")
            .single();
          conversationId = created?.id || null;
        }

        if (!conversationId) continue;

        const content =
          message?.text?.body ||
          message?.interactive?.button_reply?.title ||
          message?.interactive?.list_reply?.title ||
          `[${message?.type || "message"}]`;

        await supabase.from("messages").insert({
          conversation_id: conversationId,
          direction: "inbound",
          content,
          message_type: message?.type || "text",
          whatsapp_message_id: message?.id || null,
          status: "received",
          platform: "whatsapp",
        });
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token") || "";
    const challenge = url.searchParams.get("hub.challenge") || "";
    const expectedToken = await loadVerifyToken(supabase);

    if (mode === "subscribe" && token && token === expectedToken) {
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }

    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    await saveInboundAudit(supabase, payload);
    return new Response(JSON.stringify({ received: true, bookingFlowDisabled: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ received: false, error: error instanceof Error ? error.message : String(error) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
