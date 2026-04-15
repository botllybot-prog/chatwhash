const https = require("https");

const SQL = `
ALTER TABLE employees ADD COLUMN IF NOT EXISTS can_add_service BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS can_edit_prices BOOLEAN NOT NULL DEFAULT false;
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
    if (data === "[]" || data === "") console.log("✅ Migration applied successfully");
    else console.log("Response:", data);
  });
});
req.on("error", (e) => console.error(e));
req.write(body);
req.end();
