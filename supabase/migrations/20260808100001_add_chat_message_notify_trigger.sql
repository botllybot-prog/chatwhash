-- Fires on every chat_messages insert, regardless of whether the row was
-- inserted by an edge function (customer side, service role) or directly by
-- an owner/admin client via RLS -- mirrors trg_notify_booking_change_edge_function
-- exactly so both directions of chat notification go through one code path.

create or replace function public.notify_chat_message_edge_function()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
begin
  payload := jsonb_build_object(
    'type', tg_op,
    'record', to_jsonb(new)
  );

  perform net.http_post(
    url := 'https://yhklvtzonvgzkodysawu.supabase.co/functions/v1/notify-on-chat-message',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := payload,
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_chat_message_edge_function on public.chat_messages;

create trigger trg_notify_chat_message_edge_function
after insert on public.chat_messages
for each row
execute function public.notify_chat_message_edge_function();
