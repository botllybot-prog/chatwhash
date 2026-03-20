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

              // Step 1: Check for duplicate message
              if (msg.id) {
                const { data: existingMsg } = await supabase
                  .from("messages")
                  .select("id")
                  .eq("whatsapp_message_id", msg.id)
                  .maybeSingle();
                if (existingMsg) {
                  console.log(`Duplicate message skipped: ${msg.id}`);
                  continue;
                }
              }

              // Step 2: Find or create conversation (select first, insert if needed)
              let convId: string;
              const { data: existingConv } = await supabase
                .from("conversations")
                .select("id")
                .eq("customer_phone", phone)
                .eq("status", "open")
                .limit(1)
                .maybeSingle();

              if (existingConv) {
                convId = existingConv.id;
                // Update last_message_at and customer_name
                await supabase
                  .from("conversations")
                  .update({ last_message_at: now, customer_name: contactName })
                  .eq("id", convId);
              } else {
                const { data: newConv, error: newConvErr } = await supabase
                  .from("conversations")
                  .insert({
                    customer_phone: phone,
                    customer_name: contactName,
                    status: "open",
                    last_message_at: now,
                  })
                  .select("id")
                  .single();

                if (newConvErr || !newConv) {
                  console.error("Failed to create conversation:", newConvErr);
                  // Race condition: another request may have created it
                  const { data: retryConv } = await supabase
                    .from("conversations")
                    .select("id")
                    .eq("customer_phone", phone)
                    .eq("status", "open")
                    .limit(1)
                    .maybeSingle();
                  if (!retryConv) {
                    console.error("Could not find or create conversation for:", phone);
                    continue;
                  }
                  convId = retryConv.id;
                } else {
                  convId = newConv.id;
                }
              }

              // Step 3: Insert message
              const { error: msgErr } = await supabase
                .from("messages")
                .insert({
                  conversation_id: convId,
                  direction: "inbound",
                  content,
                  message_type: messageType,
                  whatsapp_message_id: msg.id,
                  status: "delivered",
                });

              if (msgErr) {
                console.error("Message insert error:", msgErr);
              } else {
                console.log(`Message saved for conversation ${convId}`);
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
