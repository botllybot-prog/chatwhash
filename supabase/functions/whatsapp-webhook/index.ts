import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getSettings(supabase: any) {
  const { data } = await supabase.from("app_settings").select("key, value");
  const settings: Record<string, string> = {};
  if (data) {
    for (const row of data) {
      settings[row.key] = row.value;
    }
  }
  return settings;
}

async function verifySignature(body: string, signature: string, appSecret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hashArray = Array.from(new Uint8Array(sig));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256=${hashHex}` === signature;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const settings = await getSettings(supabase);

  // GET: Webhook verification
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === settings.WHATSAPP_VERIFY_TOKEN) {
      console.log("Webhook verified");
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // POST: Incoming messages
  if (req.method === "POST") {
    const bodyText = await req.text();

    // Verify signature if app secret is set
    if (settings.WHATSAPP_APP_SECRET) {
      const signature = req.headers.get("x-hub-signature-256") || "";
      const valid = await verifySignature(bodyText, signature, settings.WHATSAPP_APP_SECRET);
      if (!valid) {
        console.error("Invalid signature");
        return new Response("Invalid signature", { status: 401 });
      }
    }

    const body = JSON.parse(bodyText);

    try {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value;

          // Handle status updates
          if (value.statuses) {
            for (const status of value.statuses) {
              const waMessageId = status.id;
              const newStatus = status.status; // sent, delivered, read
              await supabase
                .from("messages")
                .update({ status: newStatus })
                .eq("whatsapp_message_id", waMessageId);
            }
          }

          // Handle incoming messages
          if (value.messages) {
            for (const msg of value.messages) {
              const phone = msg.from;
              const contactName = value.contacts?.[0]?.profile?.name || phone;
              const content = msg.text?.body || msg.type || "";
              const messageType = msg.type || "text";

              // Find or create conversation
              let { data: conv } = await supabase
                .from("conversations")
                .select("id")
                .eq("customer_phone", phone)
                .eq("status", "open")
                .maybeSingle();

              if (!conv) {
                const { data: newConv } = await supabase
                  .from("conversations")
                  .insert({
                    customer_phone: phone,
                    customer_name: contactName,
                    status: "open",
                    last_message_at: new Date().toISOString(),
                  })
                  .select("id")
                  .single();
                conv = newConv;
              } else {
                await supabase
                  .from("conversations")
                  .update({
                    last_message_at: new Date().toISOString(),
                    customer_name: contactName,
                  })
                  .eq("id", conv.id);
              }

              // Insert message
              await supabase.from("messages").insert({
                conversation_id: conv!.id,
                direction: "inbound",
                content,
                message_type: messageType,
                whatsapp_message_id: msg.id,
                status: "received",
              });
            }
          }
        }
      }
    } catch (error) {
      console.error("Error processing webhook:", error);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
});
