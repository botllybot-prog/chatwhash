import { createClient } from "npm:@supabase/supabase-js@2";

const headers = { "Content-Type": "application/json" };

// Chat media lives in Netlify Blobs (see netlify/edge-functions/chat-media.ts),
// not Supabase Storage, so it has to be deleted over HTTP -- there's no DB
// row to just drop. Media keys must be read out before chat_messages rows
// are deleted, since that's the only place they're recorded.
const DEFAULT_SITE_URL = "https://washlly.com";
const MEDIA_ROUTE_PREFIX = "/api/chat-media";
const CHAT_NOTIFICATION_TITLE = "رسالة جديدة";
const DELETE_BATCH_SIZE = 20;

async function deleteMediaKey(siteUrl: string, serviceRoleKey: string, key: string) {
  const path = `${MEDIA_ROUTE_PREFIX}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const response = await fetch(new URL(path, siteUrl), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${serviceRoleKey}` },
  });
  return response.ok || response.status === 404;
}

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const siteUrl = Deno.env.get("SITE_URL") || DEFAULT_SITE_URL;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: rows, error: readError } = await supabase
      .from("chat_messages")
      .select("media_key")
      .not("media_key", "is", null);

    if (readError) return new Response(JSON.stringify({ error: readError.message }), { status: 500, headers });

    const mediaKeys = [...new Set((rows || []).map((row: any) => row.media_key as string).filter(Boolean))];

    let mediaDeleted = 0;
    let mediaFailed = 0;
    for (let i = 0; i < mediaKeys.length; i += DELETE_BATCH_SIZE) {
      const batch = mediaKeys.slice(i, i + DELETE_BATCH_SIZE);
      const results = await Promise.allSettled(batch.map((key) => deleteMediaKey(siteUrl, serviceRoleKey, key)));
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) mediaDeleted++;
        else mediaFailed++;
      }
    }

    const { count: messagesDeleted, error: messagesError } = await supabase
      .from("chat_messages")
      .delete({ count: "exact" })
      .not("id", "is", null);
    if (messagesError) return new Response(JSON.stringify({ error: messagesError.message }), { status: 500, headers });

    await supabase.from("chat_threads").update({ last_message_at: null }).not("last_message_at", "is", null);
    await supabase.from("notifications").delete().eq("type", "chat");
    await supabase.from("customer_notifications").delete().eq("title", CHAT_NOTIFICATION_TITLE);

    return new Response(
      JSON.stringify({ success: true, messagesDeleted, mediaDeleted, mediaFailed }),
      { headers },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }),
      { status: 500, headers },
    );
  }
});
