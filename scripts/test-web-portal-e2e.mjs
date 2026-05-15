import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://yhklvtzonvgzkodysawu.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inloa2x2dHpvbnZnemtvZHlzYXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTgyMzYsImV4cCI6MjA5MTA3NDIzNn0.K0sxdzG1C1ytFU7Zb-ZCY2tCyEG2ryVUE-7SNdmo7xc";

const adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function pad2(v) {
  return String(v).padStart(2, "0");
}

function tomorrowDate() {
  const dt = new Date();
  dt.setDate(dt.getDate() + 1);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function normalizeIraqPhone07(seed) {
  const numeric = String(seed).replace(/\D/g, "");
  const tail = numeric.slice(-9).padStart(9, "0");
  return `07${tail}`;
}

async function invoke(fn, body, token = SUPABASE_ANON_KEY) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  const seed = Date.now();
  const ownerPhone = normalizeIraqPhone07(seed);
  const customerPhone1 = normalizeIraqPhone07(seed + 12345);
  const customerPhone2 = normalizeIraqPhone07(seed + 54321);
  const ownerPassword = "123456";
  const bookingDate = tomorrowDate();

  const register = await invoke("owner-self-register", {
    owner_name: `E2E Owner ${seed}`,
    owner_phone: ownerPhone,
    password: ownerPassword,
    free_requests_quota: 20,
    station: {
      name: `E2E Station ${seed}`,
      address: "Erbil",
      detailed_address: "E2E test station",
      working_hours_start: "08:00",
      working_hours_end: "22:00",
      scheduling_type: "slots",
      slot_duration_minutes: 30,
      latitude: 36.1911,
      longitude: 44.0092,
      image_url: null,
      category: "car_wash",
    },
    services: [
      {
        name: "غسل سطحي",
        price: 6000,
        duration_minutes: 30,
        customer_discount: null,
        sort_order: 0,
      },
    ],
  });

  if (!register.ok || !register.json?.success) {
    throw new Error(`owner-self-register failed: ${register.status} ${JSON.stringify(register.json)}`);
  }

  const stationId = register.json.station_id;
  const email = register.json.email;

  const ownerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const signIn = await ownerClient.auth.signInWithPassword({ email, password: ownerPassword });
  if (signIn.error || !signIn.data?.session?.access_token) {
    throw new Error(`owner sign in failed: ${signIn.error?.message || "no session"}`);
  }
  const ownerToken = signIn.data.session.access_token;

  const { data: serviceRows, error: serviceError } = await adminClient
    .from("services")
    .select("id,name")
    .eq("station_id", stationId)
    .eq("is_active", true)
    .limit(1);
  if (serviceError || !serviceRows?.[0]) {
    throw new Error(`service lookup failed: ${serviceError?.message || "no service row"}`);
  }
  const serviceId = serviceRows[0].id;

  const createBooking = async (time, customerName, customerPhone) => {
    const spin = await invoke("spin-booking-discount", {
      station_id: stationId,
      service_id: serviceId,
      booking_date: bookingDate,
      booking_time: time,
      customer_phone: customerPhone,
    });
    if (!spin.ok || !spin.json?.success || !spin.json?.token) {
      throw new Error(`spin-booking-discount failed: ${spin.status} ${JSON.stringify(spin.json)}`);
    }

    const res = await invoke("create-map-booking", {
      station_id: stationId,
      service_id: serviceId,
      customer_name: customerName,
      customer_phone: customerPhone,
      booking_date: bookingDate,
      booking_time: time,
      spin_discount_percent: Number(spin.json.discountPercent || 0),
      spin_token: spin.json.token,
      language: "ar",
    });
    if (!res.ok || !res.json?.success) {
      throw new Error(`create-map-booking failed: ${res.status} ${JSON.stringify(res.json)}`);
    }
    return res.json;
  };

  const b1 = await createBooking("12:00", "E2E Customer 1", customerPhone1);
  const b2 = await createBooking("12:30", "E2E Customer 2", customerPhone2);
  const b3 = await createBooking("13:00", "E2E Customer 3", normalizeIraqPhone07(seed + 77777));

  const ownerDb = ownerClient;

  const { data: initialBookings, error: loadErr } = await ownerDb
    .from("bookings")
    .select("id,booking_number,status,booking_date,booking_time,station_id")
    .eq("station_id", stationId)
    .in("id", [b1.bookingId, b2.bookingId, b3.bookingId]);
  if (loadErr) throw new Error(`owner load bookings failed: ${loadErr.message}`);

  const callOwnerAction = async (bookingId, action, extra = {}) => {
    const res = await invoke(
      "owner-manage-booking",
      { booking_id: bookingId, action, ...extra },
      ownerToken,
    );
    if (!res.ok || !res.json?.success) {
      throw new Error(`owner-manage-booking ${action} failed: ${res.status} ${JSON.stringify(res.json)}`);
    }
  };

  await callOwnerAction(b1.bookingId, "confirm");
  await callOwnerAction(b2.bookingId, "reject");
  await callOwnerAction(b3.bookingId, "postpone", { booking_date: bookingDate, booking_time: "14:30" });

  const { data: finalRows, error: finalErr } = await ownerDb
    .from("bookings")
    .select("id,booking_number,status,booking_date,booking_time")
    .in("id", [b1.bookingId, b2.bookingId, b3.bookingId]);
  if (finalErr) throw new Error(`final read failed: ${finalErr.message}`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        stationId,
        ownerPhone,
        customerPhone1,
        customerPhone2,
        initialBookings,
        finalBookings: finalRows,
        checks: {
          confirmWorked: finalRows?.some((r) => r.id === b1.bookingId && r.status === "confirmed") || false,
          rejectWorked: finalRows?.some((r) => r.id === b2.bookingId && r.status === "cancelled") || false,
          postponeWorked:
            finalRows?.some(
              (r) =>
                r.id === b3.bookingId &&
                r.status === "pending_customer_approval" &&
                String(r.booking_time || "").startsWith("14:30"),
            ) || false,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error?.message || error) }, null, 2));
  process.exit(1);
});
