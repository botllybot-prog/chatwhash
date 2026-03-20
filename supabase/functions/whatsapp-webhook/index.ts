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

// Get file extension from mime type
function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "audio/aac": "aac", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/amr": "amr",
    "audio/ogg": "ogg", "audio/opus": "opus",
    "video/mp4": "mp4", "video/3gp": "3gp",
    "image/webp": "webp",
  };
  return map[mimeType] || mimeType.split("/")[1] || "bin";
}

// Download media from WhatsApp and upload to Supabase Storage
async function downloadAndStoreMedia(
  mediaId: string,
  accessToken: string,
  supabase: any,
  messageType: string,
  mimeType?: string
): Promise<string | null> {
  try {
    // Step 1: Get media URL from WhatsApp
    const mediaInfoRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!mediaInfoRes.ok) {
      console.error("Failed to get media info:", await mediaInfoRes.text());
      return null;
    }
    const mediaInfo = await mediaInfoRes.json();
    const mediaUrl = mediaInfo.url;
    const mediaMime = mimeType || mediaInfo.mime_type || "application/octet-stream";

    // Step 2: Download the actual file
    const fileRes = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!fileRes.ok) {
      console.error("Failed to download media:", fileRes.status);
      return null;
    }
    const fileBlob = await fileRes.blob();

    // Step 3: Upload to Supabase Storage
    const ext = getExtension(mediaMime);
    const filePath = `${messageType}/${mediaId}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("whatsapp-media")
      .upload(filePath, fileBlob, {
        contentType: mediaMime,
        upsert: true,
      });

    if (uploadErr) {
      console.error("Storage upload error:", uploadErr);
      return null;
    }

    // Step 4: Get public URL
    const { data: urlData } = supabase.storage
      .from("whatsapp-media")
      .getPublicUrl(filePath);

    console.log(`Media stored: ${filePath}`);
    return urlData?.publicUrl || null;
  } catch (e) {
    console.error("Media download/store error:", e);
    return null;
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
              const messageType = msg.type || "text";

              let content = "";
              let mediaId: string | null = null;
              let mediaMime: string | undefined;

              switch (msg.type) {
                case "text":
                  content = msg.text?.body || "";
                  break;
                case "image":
                  content = msg.image?.caption || "📷 صورة";
                  mediaId = msg.image?.id;
                  mediaMime = msg.image?.mime_type;
                  break;
                case "audio":
                  content = "🎵 رسالة صوتية";
                  mediaId = msg.audio?.id;
                  mediaMime = msg.audio?.mime_type;
                  break;
                case "video":
                  content = msg.video?.caption || "🎥 فيديو";
                  mediaId = msg.video?.id;
                  mediaMime = msg.video?.mime_type;
                  break;
                case "document":
                  content = msg.document?.filename || "📄 مستند";
                  mediaId = msg.document?.id;
                  mediaMime = msg.document?.mime_type;
                  break;
                case "sticker":
                  content = "😊 ملصق";
                  mediaId = msg.sticker?.id;
                  mediaMime = msg.sticker?.mime_type;
                  break;
                case "location":
                  content = "📍 موقع";
                  break;
                case "contacts":
                  content = "👤 جهة اتصال";
                  break;
                default:
                  content = msg.type || "";
              }

              const now = new Date().toISOString();
              console.log(`Incoming ${messageType} from ${phone}: ${content.substring(0, 50)}`);

              // Check for duplicate message
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

              // Download and store media if applicable
              let mediaUrl: string | null = null;
              if (mediaId && settings.WHATSAPP_ACCESS_TOKEN) {
                mediaUrl = await downloadAndStoreMedia(
                  mediaId,
                  settings.WHATSAPP_ACCESS_TOKEN,
                  supabase,
                  messageType,
                  mediaMime
                );
              }

              // Find or create conversation
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

              // Insert message with media_url
              const { error: msgErr } = await supabase
                .from("messages")
                .insert({
                  conversation_id: convId,
                  direction: "inbound",
                  content,
                  message_type: messageType,
                  whatsapp_message_id: msg.id,
                  status: "delivered",
                  media_url: mediaUrl,
                });

              if (msgErr) {
                console.error("Message insert error:", msgErr);
              } else {
                console.log(`Message saved for conversation ${convId}${mediaUrl ? ' (with media)' : ''}`);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error processing webhook:", error);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
});
