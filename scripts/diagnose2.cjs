const https = require('https');
const token = 'sbp_96107352e575c58e1f36b2ccb6a3bbea4db8d63f';
const projectId = 'yhklvtzonvgzkodysawu';
function query(sql) {
  return new Promise((res, rej) => {
    const body = JSON.stringify({ query: sql });
    const req = https.request({ hostname: 'api.supabase.com', path: '/v1/projects/' + projectId + '/database/query', method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); });
    req.on('error', rej); req.write(body); req.end();
  });
}
(async () => {
  // Check the enum type values for bookings.status
  const enumVals = await query("SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname LIKE '%booking%' OR t.typname LIKE '%status%' ORDER BY t.typname, e.enumsortorder");
  console.log('=== booking/status enum values ===');
  console.log(JSON.stringify(enumVals, null, 2));

  // Also check ALL enums in the schema
  const allEnums = await query("SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid ORDER BY t.typname, e.enumsortorder");
  console.log('=== all enum values ===');
  console.log(JSON.stringify(allEnums, null, 2));

  // Check sessions/bot_sessions table
  const sessTable = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name IN ('sessions','bot_sessions') ORDER BY table_name, ordinal_position");
  console.log('=== sessions columns ===');
  console.log(JSON.stringify(sessTable, null, 2));
})();
