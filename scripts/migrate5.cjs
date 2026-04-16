const https = require("https");

const SQL = `
-- ========================================================
-- PHASE 1 FIX: Employee RLS Policies
-- Date: 2026-04-17
-- ========================================================

-- 1. Allow employees with can_create_stations to INSERT into stations
CREATE POLICY "Employees can insert stations"
ON stations FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM employees e
    WHERE e.user_id = auth.uid()
      AND e.can_create_stations = true
      AND e.is_active = true
  )
);

-- 2. Allow employees with can_add_service to INSERT into services
CREATE POLICY "Employees can insert services"
ON services FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM employees e
    WHERE e.user_id = auth.uid()
      AND e.can_add_service = true
      AND e.is_active = true
  )
);

-- 3. Allow employees with can_edit_prices to UPDATE services
CREATE POLICY "Employees can update service prices"
ON services FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM employees e
    WHERE e.user_id = auth.uid()
      AND e.can_edit_prices = true
      AND e.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM employees e
    WHERE e.user_id = auth.uid()
      AND e.can_edit_prices = true
      AND e.is_active = true
  )
);

-- 4. Allow employees to SELECT their own record (needed for permission checks)
CREATE POLICY "Employees can read own record"
ON employees FOR SELECT
USING (
  user_id = auth.uid()
);
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
      console.error("❌ Migration failed:", parsed);
    } else {
      console.log("✅ Phase 1 RLS policies applied successfully");
      console.log(JSON.stringify(parsed, null, 2));
    }
  });
});
req.on("error", (e) => console.error("Request error:", e));
req.write(body);
req.end();
