import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { identifier } = await req.json();
    const rawIdentifier = String(identifier ?? "").trim();

    if (!rawIdentifier) {
      return json({ error: "MISSING_IDENTIFIER" }, 400);
    }

    const normalizedPhone = normalizePhone(rawIdentifier);
    const phoneLike = /^\d{11,15}$/.test(normalizedPhone);

    let userId: string | null = null;

    if (phoneLike) {
      const { data: ownerByPhone } = await supabaseAdmin
        .from("station_owners")
        .select("user_id")
        .eq("owner_phone", normalizedPhone)
        .maybeSingle();

      userId = ownerByPhone?.user_id || null;
    }

    if (!userId) {
      const { data: ownersByName } = await supabaseAdmin
        .from("station_owners")
        .select("user_id")
        .ilike("owner_name", rawIdentifier)
        .limit(2);

      if ((ownersByName?.length || 0) > 1) {
        return json({ error: "AMBIGUOUS_OWNER_NAME" }, 409);
      }

      userId = ownersByName?.[0]?.user_id || null;
    }

    if (!userId) {
      return json({ error: "OWNER_NOT_FOUND" }, 404);
    }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authError || !authUser.user?.email) {
      return json({ error: "AUTH_USER_NOT_FOUND" }, 404);
    }

    return json({
      success: true,
      email: authUser.user.email,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
