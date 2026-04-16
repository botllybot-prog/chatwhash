const https = require("https");

const SQL = `
-- ========================================================
-- MIGRATION 7: Debt Collection & Suspension Flow
-- Date: 2026-04-23
-- ========================================================

-- 1. Add outstanding_debt to station_owners
ALTER TABLE station_owners ADD COLUMN IF NOT EXISTS outstanding_debt NUMERIC DEFAULT 0 NOT NULL;
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
      console.log("✅ migrate7 applied: outstanding_debt column added to station_owners");
    }
  });
});
req.on("error", (e) => console.error("Request error:", e));
req.write(body);
req.end();
