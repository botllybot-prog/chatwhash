-- Tracks what customers search for (stations and services) so popularity can
-- be measured, and lets admins manually boost specific stations/services so
-- they appear first on the customer-facing "Top Picks" page regardless of
-- organic search volume.

create table if not exists public.search_events (
  id uuid primary key default gen_random_uuid(),
  search_type text not null check (search_type in ('station', 'service')),
  query text not null,
  station_id uuid references public.stations(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  customer_phone text,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_search_events_station_id on public.search_events(station_id);
create index if not exists idx_search_events_service_id on public.search_events(service_id);
create index if not exists idx_search_events_created_at on public.search_events(created_at);

-- No public RLS policies: customers have no Supabase Auth session, so writes
-- go through the log-search-event Edge Function (service role) and reads for
-- the Top Picks page go through the get-top-picks Edge Function (service
-- role), the same trust boundary already used for device_tokens.
alter table public.search_events enable row level security;

alter table public.stations
  add column if not exists is_boosted boolean not null default false,
  add column if not exists boost_priority integer not null default 0;

alter table public.services
  add column if not exists is_boosted boolean not null default false,
  add column if not exists boost_priority integer not null default 0;
