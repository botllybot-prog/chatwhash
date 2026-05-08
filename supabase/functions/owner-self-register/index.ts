import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SchedulingType = "slots" | "instant" | "daily";

type RegisterPayload = {
  owner_name?: string;
  owner_phone?: string;
  email?: string | null;
  password?: string;
  free_requests_quota?: number;
  station?: {
    name?: string;
    address?: string;
    detailed_address?: string;
    working_hours_start?: string;
    working_hours_end?: string;
    scheduling_type?: SchedulingType;
    slot_duration_minutes?: number;
    latitude?: number | null;
    longitude?: number | null;
    image_url?: string | null;
  };
  services?: Array<{
    name?: string;
    price?: number;
    duration_minutes?: number;
    customer_discount?: string | null;
    sort_order?: number;
  }>;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizePhone(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.substring(1)}`;
  return cleaned;
}

function buildOwnerEmail(identifier: string, providedEmail?: string | null) {
  const normalizedProvidedEmail = providedEmail?.trim().toLowerCase();
  if (normalizedProvidedEmail) return normalizedProvidedEmail;
  const normalizedPhone = normalizePhone(identifier);
  return `owner-${normalizedPhone}@washlly.local`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let createdUserId: string | null = null;
  let createdStationId: string | null = null;

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const payload = (await req.json()) as RegisterPayload;
    const ownerName = payload.owner_name?.trim();
    const ownerPhone = normalizePhone(payload.owner_phone ?? "");
    const password = payload.password;
    const stationName = payload.station?.name?.trim();
    const rawServices = Array.isArray(payload.services) ? payload.services : [];
    const validServices = rawServices
      .filter((service) => service?.name?.trim() && Number(service.price) > 0)
      .map((service, index) => ({
        name: service.name!.trim(),
        price: Number(service.price),
        duration_minutes: Number(service.duration_minutes) || 30,
        customer_discount: service.customer_discount?.trim() || null,
        sort_order: Number(service.sort_order ?? index),
        is_active: true,
      }));

    if (!ownerName || !ownerPhone || !password || !stationName) {
      return json({ error: "Missing required fields" }, 400);
    }

    if (password.length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400);
    }

    if (validServices.length === 0) {
      return json({ error: "At least one service is required" }, 400);
    }

    const authEmail = buildOwnerEmail(ownerPhone, payload.email);

    let createdBy: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
      if (caller) {
        const { data: roleData } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", caller.id)
          .maybeSingle();

        if (roleData?.role === "admin" || roleData?.role === "employee") {
          createdBy = caller.id;
        }
      }
    }

    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const duplicateUser = existingUser.users.find((user) => user.email?.toLowerCase() === authEmail);
    if (duplicateUser) {
      return json({ error: "An account with this WhatsApp number or email already exists" }, 409);
    }

    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        owner_name: ownerName,
        owner_phone: ownerPhone,
      },
    });

    if (createUserError || !newUser.user) {
      return json({ error: createUserError?.message || "Failed to create owner account" }, 400);
    }

    createdUserId = newUser.user.id;

    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: createdUserId,
      role: "station_owner",
    });

    if (roleError) {
      throw roleError;
    }

    const stationPayload = {
      name: stationName,
      address: payload.station?.address?.trim() || null,
      detailed_address: payload.station?.detailed_address?.trim() || null,
      working_hours_start: payload.station?.working_hours_start || "08:00",
      working_hours_end: payload.station?.working_hours_end || "22:00",
      scheduling_type: payload.station?.scheduling_type || "slots",
      slot_duration_minutes: Number(payload.station?.slot_duration_minutes) || 30,
      latitude: payload.station?.latitude ?? null,
      longitude: payload.station?.longitude ?? null,
      image_url: payload.station?.image_url ?? null,
      is_active: true,
    };

    const { data: stationRecord, error: stationError } = await supabaseAdmin
      .from("stations")
      .insert(stationPayload)
      .select("id")
      .single();

    if (stationError || !stationRecord) {
      throw stationError || new Error("Failed to create station");
    }

    createdStationId = stationRecord.id;

    const defaultFreeQuota = createdBy ? Math.max(0, Number(payload.free_requests_quota ?? 20) || 20) : 20;

    const ownerPayload: Record<string, unknown> = {
      user_id: createdUserId,
      station_id: createdStationId,
      owner_name: ownerName,
      owner_phone: ownerPhone,
      free_requests_quota: defaultFreeQuota,
      free_requests_used: 0,
    };

    if (createdBy) {
      ownerPayload.created_by = createdBy;
    }

    const { error: ownerError } = await supabaseAdmin
      .from("station_owners")
      .insert(ownerPayload);

    if (ownerError) {
      throw ownerError;
    }

    const servicesPayload = validServices.map((service) => ({
      ...service,
      station_id: createdStationId,
    }));

    const { error: servicesError } = await supabaseAdmin
      .from("services")
      .insert(servicesPayload);

    if (servicesError) {
      throw servicesError;
    }

    return json({
      success: true,
      user_id: createdUserId,
      station_id: createdStationId,
      email: authEmail,
    });
  } catch (error) {
    console.error("owner-self-register error", error);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (createdStationId) {
      await supabaseAdmin.from("stations").delete().eq("id", createdStationId);
    }

    if (createdUserId) {
      await supabaseAdmin.auth.admin.deleteUser(createdUserId);
    }

    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
