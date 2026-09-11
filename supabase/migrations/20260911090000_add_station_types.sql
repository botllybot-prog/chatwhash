-- Admin-managed station types (distinct from the fixed `category` enum):
-- each type carries a pin color so the map can color-code markers by type.
create table if not exists public.station_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin_color text not null default '#2563eb',
  created_at timestamp with time zone not null default now()
);

alter table public.stations
  add column if not exists station_type_id uuid references public.station_types(id) on delete set null;

create index if not exists idx_stations_station_type_id on public.stations(station_type_id);

alter table public.station_types enable row level security;

drop policy if exists "Public can read station types" on public.station_types;
create policy "Public can read station types"
  on public.station_types
  for select
  using (true);

drop policy if exists "Admins can manage station types" on public.station_types;
create policy "Admins can manage station types"
  on public.station_types
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
