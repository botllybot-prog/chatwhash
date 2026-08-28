-- Nightly cleanup: wipe all chat messages (direct + group threads) at
-- midnight Iraq time (UTC+3, no DST) = 21:00 UTC.
create extension if not exists pg_cron with schema pg_catalog;

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
  delete from public.chat_messages;
  update public.chat_threads set last_message_at = null where last_message_at is not null;
  $$
);
