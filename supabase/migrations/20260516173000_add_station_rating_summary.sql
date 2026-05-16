alter table public.stations
  add column if not exists rating_average numeric(3,2) not null default 0,
  add column if not exists rating_count integer not null default 0;

create index if not exists idx_bookings_station_customer_rating
  on public.bookings(station_id, customer_rating)
  where customer_rating is not null;

create or replace function public.recalculate_station_rating(target_station_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_average numeric(3,2);
  next_count integer;
begin
  if target_station_id is null then
    return;
  end if;

  select
    coalesce(round(avg(customer_rating)::numeric, 2), 0)::numeric(3,2),
    count(customer_rating)::integer
  into next_average, next_count
  from public.bookings
  where station_id = target_station_id
    and customer_rating is not null;

  update public.stations
  set
    rating_average = next_average,
    rating_count = next_count
  where id = target_station_id;
end;
$$;

create or replace function public.sync_station_rating_from_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_station_rating(old.station_id);
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.customer_rating is not null then
      perform public.recalculate_station_rating(new.station_id);
    end if;
    return new;
  end if;

  if old.station_id is distinct from new.station_id
    or old.customer_rating is distinct from new.customer_rating then
    perform public.recalculate_station_rating(old.station_id);
    perform public.recalculate_station_rating(new.station_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_station_rating_from_booking on public.bookings;
create trigger trg_sync_station_rating_from_booking
after insert or update of station_id, customer_rating or delete on public.bookings
for each row
execute function public.sync_station_rating_from_booking();

do $$
declare
  station_row record;
begin
  for station_row in select id from public.stations loop
    perform public.recalculate_station_rating(station_row.id);
  end loop;
end;
$$;
