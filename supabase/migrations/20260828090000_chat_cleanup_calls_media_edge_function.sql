-- Chat media lives in Netlify Blobs, not Postgres, so the nightly purge can
-- no longer be plain SQL: it now calls the cleanup-chat-media edge function,
-- which reads each message's media_key, deletes the blob over HTTP, and only
-- then deletes the DB rows (chat_messages, notifications, customer_notifications,
-- chat_threads.last_message_at) -- same job as before, same schedule.
do $$
begin
  perform cron.unschedule('cleanup-chat-messages-daily');
exception
  when others then
    null;
end $$;

select cron.schedule(
  'cleanup-chat-messages-daily',
  '0 21 * * *',
  $$
  select net.http_post(
    url := 'https://yhklvtzonvgzkodysawu.supabase.co/functions/v1/cleanup-chat-media',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) as request_id;
  $$
);
