const sql = `
  ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'employee';

  CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    can_create_owners BOOLEAN NOT NULL DEFAULT false,
    can_create_stations BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='employees' AND policyname='admin_all_employees') THEN
      CREATE POLICY admin_all_employees ON public.employees FOR ALL USING (true);
    END IF;
  END $$;

  ALTER TABLE public.station_owners ADD COLUMN IF NOT EXISTS created_by UUID;
  ALTER TABLE public.stations ADD COLUMN IF NOT EXISTS created_by UUID;
`;

fetch('https://api.supabase.com/v1/projects/yhklvtzonvgzkodysawu/database/query', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sbp_96107352e575c58e1f36b2ccb6a3bbea4db8d63f',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query: sql })
}).then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 2)));
