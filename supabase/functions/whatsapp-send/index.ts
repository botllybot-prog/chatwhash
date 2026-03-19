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

  // Get settings from DB
  const { data: settingsData } = await supabase.from("app_settings").select("key, value");
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

  const { conversation_id, to, message } = await req.json();

  if (!conversation_id || !to || !message) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: conversation_id, to, message" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Send via WhatsApp Cloud API
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
      console.error("WhatsApp API error:", waData);
      return new Response(
        JSON.stringify({ error: "Failed to send message", details: waData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const waMessageId = waData.messages?.[0]?.id || null;

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
      console.error("DB error:", dbError);
    }

    // Update conversation timestamp
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversation_id);

    return new Response(
      JSON.stringify({ success: true, message: msgData, whatsapp_message_id: waMessageId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Send error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
