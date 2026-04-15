const fs = require("fs");

async function deploy(slug, filePath, verifyJwt = true) {
  const code = fs.readFileSync(filePath, "utf8");
  const res = await fetch(`https://api.supabase.com/v1/projects/yhklvtzonvgzkodysawu/functions/${slug}`, {
    method: "PATCH",
    headers: {
      "Authorization": "Bearer sbp_96107352e575c58e1f36b2ccb6a3bbea4db8d63f",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ slug, name: slug, verify_jwt: verifyJwt, body: code }),
  });
  const d = await res.json();
  if (d.error || d.message) {
    // Try POST (create) if PATCH failed
    const res2 = await fetch(`https://api.supabase.com/v1/projects/yhklvtzonvgzkodysawu/functions`, {
      method: "POST",
      headers: {
        "Authorization": "Bearer sbp_96107352e575c58e1f36b2ccb6a3bbea4db8d63f",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ slug, name: slug, verify_jwt: verifyJwt, body: code }),
    });
    const d2 = await res2.json();
    console.log(slug, "CREATE:", d2.status, "v" + d2.version, d2.error || "");
  } else {
    console.log(slug, "PATCH:", d.status, "v" + d.version);
  }
}

(async () => {
  await deploy("create-employee", "C:/Users/al3r18y/carw/supabase/functions/create-employee/index.ts", false);
  await deploy("delete-employee", "C:/Users/al3r18y/carw/supabase/functions/delete-employee/index.ts", false);
})();
