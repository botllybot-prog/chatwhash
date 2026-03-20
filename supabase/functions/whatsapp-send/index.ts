import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Get settings from DB
    const { data: settingsData, error: settingsErr } = await supabase
      .from("app_settings")
      .select("key, value");

    if (settingsErr) {
      console.error("Failed to load settings:", settingsErr);
      return new Response(
        JSON.stringify({ error: "Failed to load settings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const settings: Record<string, string> = {};
    if (settingsData) {
      for (const row of settingsData) {
        settings[row.key] = row.value;
      }
    }

    const accessToken = settings.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = settings.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      return new Response(
        JSON.stringify({ error: "WhatsApp not configured. Please add settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { conversation_id, to, message } = body;

    if (!conversation_id || !to || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: conversation_id, to, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify conversation exists
    const { data: convCheck, error: convErr } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversation_id)
      .maybeSingle();

    if (convErr || !convCheck) {
      console.error("Conversation not found:", conversation_id, convErr);
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send via WhatsApp Cloud API
    console.log(`Sending message to ${to} in conversation ${conversation_id}`);
    const waResponse = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: message },
        }),
      }
    );

    const waData = await waResponse.json();

    if (!waResponse.ok) {
      console.error("WhatsApp API error:", JSON.stringify(waData));
      return new Response(
        JSON.stringify({ error: "Failed to send message", details: waData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const waMessageId = waData.messages?.[0]?.id || null;
    console.log(`WhatsApp message sent, ID: ${waMessageId}`);

    // Save to DB
    const { data: msgData, error: dbError } = await supabase
      .from("messages")
      .insert({
        conversation_id,
        direction: "outbound",
        content: message,
        message_type: "text",
        whatsapp_message_id: waMessageId,
        status: "sent",
      })
      .select()
      .single();

    if (dbError) {
      console.error("DB insert error:", JSON.stringify(dbError));
      // Message was sent via WhatsApp but failed to save - still return success
      return new Response(
        JSON.stringify({ success: true, whatsapp_message_id: waMessageId, db_error: "Failed to save message locally" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update conversation timestamp
    const { error: updateErr } = await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversation_id);

    if (updateErr) {
      console.error("Conversation update error:", updateErr);
    }

    return new Response(
      JSON.stringify({ success: true, message: msgData, whatsapp_message_id: waMessageId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Send error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
