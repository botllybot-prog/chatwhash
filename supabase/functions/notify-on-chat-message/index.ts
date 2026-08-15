import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTIFICATION_TITLE = "رسالة جديدة";
const MEDIA_FALLBACK_BODY = "تم إرسال ملف وسائط";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function pushNotification(
  supabaseUrl: string,
  serviceRoleKey: string,
  phone: string,
  role: "owner" | "customer",
  title: string,
  body: string,
  data: Record<string, string>,
) {
  await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ phone, role, title, body, data }),
  }).catch(() => null);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const payload = await req.json();
    const record = payload.record || {};
    const threadId = String(record.thread_id || "");
    const senderType = String(record.sender_type || "");
    const senderId = String(record.sender_id || "");
    const messageBody = record.body ? String(record.body) : "";

    if (!threadId) return json({ success: true, skipped: "missing_thread_id" });

    const { data: members, error: membersError } = await supabase
      .from("chat_thread_members")
      .select("user_id, customer_phone")
      .eq("thread_id", threadId);

    if (membersError) return json({ error: membersError.message }, 500);

    const recipients = (members || []).filter((member: any) => {
      if (senderType === "customer") return member.customer_phone !== senderId;
      return member.user_id !== senderId;
    });

    const notificationBody = messageBody || MEDIA_FALLBACK_BODY;

    const ownerRecipients = recipients.filter((member: any) => member.user_id);
    const customerRecipients = recipients.filter((member: any) => member.customer_phone);

    if (ownerRecipients.length > 0) {
      await supabase.from("notifications").insert(
        ownerRecipients.map((member: any) => ({
          user_id: member.user_id,
          title: NOTIFICATION_TITLE,
          body: notificationBody,
          type: "chat",
          reference_id: threadId,
        })),
      );

      const { data: owners } = await supabase
        .from("station_owners")
        .select("user_id, owner_phone")
        .in("user_id", ownerRecipients.map((member: any) => member.user_id));

      await Promise.allSettled(
        (owners || [])
          .filter((owner: any) => owner.owner_phone)
          .map((owner: any) =>
            pushNotification(supabaseUrl, serviceRoleKey, owner.owner_phone, "owner", NOTIFICATION_TITLE, notificationBody, {
              thread_id: threadId,
              event: "chat_message",
            }),
          ),
      );
    }

    if (customerRecipients.length > 0) {
      await supabase.from("customer_notifications").insert(
        customerRecipients.map((member: any) => ({
          customer_phone: member.customer_phone,
          title: NOTIFICATION_TITLE,
          body: notificationBody,
        })),
      );

      await Promise.allSettled(
        customerRecipients.map((member: any) =>
          pushNotification(supabaseUrl, serviceRoleKey, member.customer_phone, "customer", NOTIFICATION_TITLE, notificationBody, {
            thread_id: threadId,
            event: "chat_message",
          }),
        ),
      );
    }

    return json({ success: true, notified_owners: ownerRecipients.length, notified_customers: customerRecipients.length });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
