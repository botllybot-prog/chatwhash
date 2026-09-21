alter table if exists public.stations
  add column if not exists city text;

create index if not exists idx_stations_city
  on public.stations(city);
