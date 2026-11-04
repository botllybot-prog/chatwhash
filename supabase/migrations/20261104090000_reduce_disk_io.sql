-- Reduce Disk IO: index the booking-reminders queries, run that job less
-- often, and stop the pg_cron / pg_net log tables from growing forever.
-- Apply after 20261020120000_add_performance_indexes.sql.
create extension if not exists pg_cron with schema pg_catalog;

-- booking-reminders: pending quick requests not yet timed out.
create index if not exists idx_quick_booking_requests_pending_unnotified
  on public.quick_booking_requests(created_at)
  where status = 'pending' and timeout_notified = false;

-- booking-reminders: confirmed bookings still waiting for a rating request.
create index if not exists idx_bookings_confirmed_rating_pending
  on public.bookings(booking_date)
  where status = 'confirmed' and rating_requested = false;

-- Every 5 minutes instead of every minute. The quick-booking timeout notice
-- ("no reply within 10 minutes") now arrives at most ~5 minutes late.
do $$
begin
  perform cron.unschedule('send-booking-reminders');
exception
  when others then
    null;
end $$;

select cron.schedule(
  'send-booking-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://yhklvtzonvgzkodysawu.supabase.co/functions/v1/booking-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Subscription checks once a day instead of every 15 minutes, at 06:00 Iraq
-- time (UTC+3) = 03:00 UTC, so the function's UTC "today" matches Iraq's date.
do $$
begin
  perform cron.unschedule('check-subscriptions-every-15-minutes');
exception
  when others then
    null;
end $$;

do $$
begin
  perform cron.unschedule('check-subscriptions-daily');
exception
  when others then
    null;
end $$;

select cron.schedule(
  'check-subscriptions-daily',
  '0 3 * * *',
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

-- One-off cleanup of the history that has built up so far.
delete from cron.job_run_details where end_time < now() - interval '3 days';
delete from net._http_response where created < now() - interval '1 day';

-- Nightly purge at 03:30 Iraq time (UTC+3) = 00:30 UTC.
do $$
begin
  perform cron.unschedule('purge-cron-and-http-logs');
exception
  when others then
    null;
end $$;

select cron.schedule(
  'purge-cron-and-http-logs',
  '30 0 * * *',
  $$
  delete from cron.job_run_details where end_time < now() - interval '3 days';
  delete from net._http_response where created < now() - interval '1 day';
  $$
);
