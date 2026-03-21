import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().split("T")[0];
    const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Load WhatsApp settings
    const { data: settingsData } = await supabase.from("app_settings").select("key, value");
    const settings: Record<string, string> = {};
    if (settingsData) settingsData.forEach((s: any) => { settings[s.key] = s.value; });
    const accessToken = settings.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = settings.WHATSAPP_PHONE_NUMBER_ID;

    // ── 1. Warn subscriptions expiring in exactly 3 days ──
    const { data: expiringSoon } = await supabase
      .from("subscriptions")
      .select("id, station_id")
      .in("status", ["active", "trial"])
      .eq("end_date", threeDaysLater);

    let warned = 0;
    for (const sub of expiringSoon || []) {
      const { data: owner } = await supabase
        .from("station_owners")
        .select("user_id, owner_phone, stations(name)")
        .eq("station_id", sub.station_id)
        .maybeSingle();

      if (!owner) continue;

      await supabase.from("notifications").insert({
        user_id: owner.user_id,
        title: "اشتراكك ينتهي قريباً",
        body: `اشتراك محطة "${(owner as any).stations?.name}" سينتهي خلال 3 أيام. يرجى التواصل مع الإدارة للتجديد.`,
        type: "subscription",
      });

      if (owner.owner_phone && accessToken && phoneNumberId) {
        const msg = `⚠️ تنبيه: اشتراك محطة "${(owner as any).stations?.name}" سينتهي خلال 3 أيام (${threeDaysLater}).\nيرجى التواصل مع الإدارة للتجديد قبل تعطيل المحطة تلقائياً.`;
        await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", to: owner.owner_phone, type: "text", text: { body: msg } }),
        });
      }
      warned++;
    }

    // ── 2. Expire overdue subscriptions ──
    const { data: expired, error: fetchErr } = await supabase
      .from("subscriptions")
      .select("id, station_id, status")
      .in("status", ["active", "trial"])
      .lt("end_date", today);

    if (fetchErr) throw fetchErr;

    if (!expired || expired.length === 0) {
      return new Response(JSON.stringify({ message: "Done", warned, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (const sub of expired) {
      await supabase
        .from("subscriptions")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", sub.id);

      await supabase
        .from("stations")
        .update({ is_active: false })
        .eq("id", sub.station_id);

      const { data: owner } = await supabase
        .from("station_owners")
        .select("user_id, owner_phone, stations(name)")
        .eq("station_id", sub.station_id)
        .maybeSingle();

      if (owner) {
        await supabase.from("notifications").insert({
          user_id: owner.user_id,
          title: "انتهى اشتراكك",
          body: "تم تعطيل محطتك تلقائياً بسبب انتهاء الاشتراك. يرجى التواصل مع الإدارة للتجديد.",
          type: "subscription",
        });

        if (owner.owner_phone && accessToken && phoneNumberId) {
          const msg = `🚫 تم تعطيل محطة "${(owner as any).stations?.name}" تلقائياً بسبب انتهاء الاشتراك.\nيرجى التواصل مع الإدارة للتجديد وإعادة التفعيل.`;
          await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ messaging_product: "whatsapp", to: owner.owner_phone, type: "text", text: { body: msg } }),
          });
        }
      }

      processed++;
    }

    // Notify admins
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (admins && admins.length > 0) {
      for (const admin of admins) {
        await supabase.from("notifications").insert({
          user_id: admin.user_id,
          title: `${processed} اشتراك منتهي${warned > 0 ? ` / ${warned} تنبيه مبكر` : ""}`,
          body: `تم تعطيل ${processed} محطة تلقائياً.${warned > 0 ? ` وتم تنبيه ${warned} صاحب محطة باقتراب انتهاء اشتراكه.` : ""}`,
          type: "subscription",
        });
      }
    }

    return new Response(JSON.stringify({ message: "Done", warned, processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
