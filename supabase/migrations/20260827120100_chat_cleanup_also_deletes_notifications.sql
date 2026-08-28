-- Extend the nightly chat cleanup job to also purge the notifications that
-- were generated from the deleted chat messages: owner-side `notifications`
-- rows of type 'chat' (see notify-on-chat-message), and customer-side
-- `customer_notifications` rows with the chat notification title (chat is
-- the only producer that leaves reference_booking_id null, but matching on
-- title keeps this from ever touching a future null-reference notification
-- type by accident).
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
  delete from public.notifications where type = 'chat';
  delete from public.customer_notifications where title = 'رسالة جديدة';
  $$
);
