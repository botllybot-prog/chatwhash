SELECT cron.schedule(
  'send-booking-reminders',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://yhklvtzonvgzkodysawu.supabase.co/functions/v1/booking-reminders',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNubmFqZHNydnVmanluemJsa21kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTUzOTMsImV4cCI6MjA4OTQ5MTM5M30.YwNiWbOaYSjFPR-Zd_OOQEJOBq4hjKxiV5MV8Ai0zlA"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
