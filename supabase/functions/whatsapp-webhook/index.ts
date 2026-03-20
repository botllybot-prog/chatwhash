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
  try {
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
  } catch (e) {
    console.error("Signature verification error:", e);
    return false;
  }
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
        console.error("Invalid webhook signature");
        // Still return 200 to prevent Meta from retrying
        return new Response(JSON.stringify({ success: false, reason: "invalid_signature" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let body: any;
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      console.error("Failed to parse webhook body:", e);
      return new Response(JSON.stringify({ success: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
              const newStatus = status.status;
              console.log(`Status update: ${waMessageId} -> ${newStatus}`);
              const { error: statusErr } = await supabase
                .from("messages")
                .update({ status: newStatus })
                .eq("whatsapp_message_id", waMessageId);
              if (statusErr) {
                console.error("Status update DB error:", statusErr);
              }
            }
          }

          // Handle incoming messages
          if (value.messages) {
            for (const msg of value.messages) {
              const phone = msg.from;
              const contactName = value.contacts?.[0]?.profile?.name || phone;
              const content = msg.text?.body || msg.type || "";
              const messageType = msg.type || "text";
              const now = new Date().toISOString();

              console.log(`Incoming message from ${phone}: ${content.substring(0, 50)}`);

              // Atomic upsert: find or create open conversation
              const { data: conv, error: convErr } = await supabase
                .from("conversations")
                .upsert(
                  {
                    customer_phone: phone,
                    customer_name: contactName,
                    status: "open",
                    last_message_at: now,
                  },
                  { onConflict: "customer_phone,status", ignoreDuplicates: false }
                )
                .select("id")
                .single();

              if (convErr || !conv) {
                console.error("Conversation upsert error:", convErr);
                // Fallback: try to find existing conversation
                const { data: existingConv } = await supabase
                  .from("conversations")
                  .select("id")
                  .eq("customer_phone", phone)
                  .eq("status", "open")
                  .limit(1)
                  .maybeSingle();

                if (!existingConv) {
                  console.error("Could not find or create conversation for:", phone);
                  continue;
                }

                // Insert message with duplicate protection
                const { error: msgErr } = await supabase
                  .from("messages")
                  .upsert(
                    {
                      conversation_id: existingConv.id,
                      direction: "inbound",
                      content,
                      message_type: messageType,
                      whatsapp_message_id: msg.id,
                      status: "received",
                    },
                    { onConflict: "whatsapp_message_id", ignoreDuplicates: true }
                  );
                if (msgErr) console.error("Message insert error (fallback):", msgErr);
                continue;
              }

              // Insert message with duplicate protection
              const { error: msgErr } = await supabase
                .from("messages")
                .upsert(
                  {
                    conversation_id: conv.id,
                    direction: "inbound",
                    content,
                    message_type: messageType,
                    whatsapp_message_id: msg.id,
                    status: "received",
                  },
                  { onConflict: "whatsapp_message_id", ignoreDuplicates: true }
                );

              if (msgErr) {
                console.error("Message insert error:", msgErr);
              } else {
                console.log(`Message saved for conversation ${conv.id}`);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error processing webhook:", error);
    }

    // Always return 200 to Meta to prevent retries
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
});
