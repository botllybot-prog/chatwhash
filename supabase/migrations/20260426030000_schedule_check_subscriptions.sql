create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault with schema vault;

select vault.create_secret(
  'https://yhklvtzonvgzkodysawu.supabase.co',
  'project_url',
  'Supabase project URL for scheduled check-subscriptions calls'
)
where not exists (
  select 1 from vault.decrypted_secrets where name = 'project_url'
);

select vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inloa2x2dHpvbnZnemtvZHlzYXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTgyMzYsImV4cCI6MjA5MTA3NDIzNn0.K0sxdzG1C1ytFU7Zb-ZCY2tCyEG2ryVUE-7SNdmo7xc',
  'anon_key',
  'Public anon key for scheduled check-subscriptions calls'
)
where not exists (
  select 1 from vault.decrypted_secrets where name = 'anon_key'
);

select cron.schedule(
  'check-subscriptions-every-15-minutes',
  '*/15 * * * *',
  $$
  select
    net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/check-subscriptions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);
