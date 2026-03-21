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

    // 1. Find active/trial subscriptions that have expired
    const { data: expired, error: fetchErr } = await supabase
      .from("subscriptions")
      .select("id, station_id, status")
      .in("status", ["active", "trial"])
      .lt("end_date", today);

    if (fetchErr) throw fetchErr;

    if (!expired || expired.length === 0) {
      return new Response(JSON.stringify({ message: "No expired subscriptions found", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (const sub of expired) {
      // Mark subscription as expired
      await supabase
        .from("subscriptions")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", sub.id);

      // Deactivate the station
      await supabase
        .from("stations")
        .update({ is_active: false })
        .eq("id", sub.station_id);

      // Notify station owner
      const { data: owner } = await supabase
        .from("station_owners")
        .select("user_id")
        .eq("station_id", sub.station_id)
        .limit(1)
        .maybeSingle();

      if (owner) {
        await supabase.from("notifications").insert({
          user_id: owner.user_id,
          title: "انتهى اشتراكك",
          body: "تم تعطيل محطتك تلقائياً بسبب انتهاء الاشتراك. يرجى التواصل مع الإدارة للتجديد.",
          type: "subscription",
        });
      }

      processed++;
    }

    // Notify admin about expired subscriptions
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (admins && admins.length > 0) {
      for (const admin of admins) {
        await supabase.from("notifications").insert({
          user_id: admin.user_id,
          title: `${processed} اشتراك منتهي`,
          body: `تم تعطيل ${processed} محطة تلقائياً بسبب انتهاء الاشتراك.`,
          type: "subscription",
        });
      }
    }

    return new Response(JSON.stringify({ message: "Done", processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
