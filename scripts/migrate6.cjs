const https = require("https");

const SQL = `
-- ========================================================
-- PHASE 2 & BUGFIX: Owner Proposes Time + Status Columns
-- Date: 2026-04-17
-- ========================================================

-- 1. Add pending_customer_approval status to enum
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'pending_customer_approval';

-- 2. Add proposed_time and proposed_date to bookings (for owner-proposed rescheduling)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proposed_time TIME;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proposed_date DATE;
`;

const token = "sbp_96107352e575c58e1f36b2ccb6a3bbea4db8d63f";
const projectId = "yhklvtzonvgzkodysawu";
const body = JSON.stringify({ query: SQL });

const options = {
  hostname: "api.supabase.com",
  path: `/v1/projects/${projectId}/database/query`,
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  },
};

const req = https.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    const parsed = JSON.parse(data);
    if (parsed.error || parsed.message) {
      console.error("❌ Migration failed:", JSON.stringify(parsed));
    } else {
      console.log("✅ migrate6 applied: pending_customer_approval + proposed_time + proposed_date");
    }
  });
});
req.on("error", (e) => console.error("Request error:", e));
req.write(body);
req.end();
