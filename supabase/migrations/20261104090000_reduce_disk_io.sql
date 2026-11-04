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

-- Every 2 minutes instead of every minute. The quick-booking timeout notice
-- ("no reply within 10 minutes") now arrives at most ~2 minutes late.
do $$
begin
  perform cron.unschedule('send-booking-reminders');
exception
  when others then
    null;
end $$;

select cron.schedule(
  'send-booking-reminders',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://yhklvtzonvgzkodysawu.supabase.co/functions/v1/booking-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
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
