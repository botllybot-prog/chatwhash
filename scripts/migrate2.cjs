const sql = `ALTER TABLE public.notifications ALTER COLUMN user_id DROP NOT NULL;`;

fetch('https://api.supabase.com/v1/projects/yhklvtzonvgzkodysawu/database/query', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sbp_96107352e575c58e1f36b2ccb6a3bbea4db8d63f',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query: sql })
}).then(r => r.json()).then(d => console.log(JSON.stringify(d)));
