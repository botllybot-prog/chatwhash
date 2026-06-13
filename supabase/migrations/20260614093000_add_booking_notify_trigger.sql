create extension if not exists pg_net with schema extensions;

create or replace function public.notify_booking_change_edge_function()
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
    'record', to_jsonb(new),
    'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) else null end
  );

  perform net.http_post(
    url := 'https://yhklvtzonvgzkodysawu.supabase.co/functions/v1/notify-on-booking-change',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := payload,
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_booking_change_edge_function on public.bookings;

create trigger trg_notify_booking_change_edge_function
after insert or update of status on public.bookings
for each row
execute function public.notify_booking_change_edge_function();
