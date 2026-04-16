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
  const cols = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='bookings' ORDER BY ordinal_position");
  console.log('=== bookings columns ===');
  console.log(cols.map(c => c.column_name + ':' + c.data_type).join(', '));
  const stat = await query("SELECT DISTINCT status FROM bookings LIMIT 20");
  console.log('=== distinct statuses ===');
  console.log(JSON.stringify(stat));
})();

(async () => {
  const cols = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='station_owners' ORDER BY ordinal_position");
  console.log('=== station_owners columns ===');
  console.log(JSON.stringify(cols, null, 2));

  const rls = await query("SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE tablename IN ('stations','employees') ORDER BY tablename, cmd");
  console.log('=== RLS policies ===');
  console.log(JSON.stringify(rls, null, 2));

  const rlsEnabled = await query("SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('stations','employees','station_owners')");
  console.log('=== RLS enabled? ===');
  console.log(JSON.stringify(rlsEnabled, null, 2));

  const appSettings = await query("SELECT key FROM app_settings");
  console.log('=== app_settings keys ===');
  console.log(JSON.stringify(appSettings, null, 2));

  const svcPolicies = await query("SELECT tablename, policyname, cmd, with_check FROM pg_policies WHERE tablename IN ('services','station_owners') ORDER BY tablename");
  console.log('=== services + station_owners policies ===');
  console.log(JSON.stringify(svcPolicies, null, 2));

  const empCols = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='employees' ORDER BY ordinal_position");
  console.log('=== employees columns ===');
  console.log(JSON.stringify(empCols, null, 2));

  const fks = await query("SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_name IN ('station_owners','services')");
  console.log('=== FKs ===');
  console.log(JSON.stringify(fks, null, 2));
})();
