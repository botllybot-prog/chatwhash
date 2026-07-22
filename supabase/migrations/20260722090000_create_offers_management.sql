create table if not exists public.offer_types (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type uuid not null references public.offer_types(id) on delete cascade,
  cities text not null
);

create table if not exists public.offer_details (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  title text,
  body text,
  url_type text not null,
  url text,
  station_id uuid references public.stations(id) on delete set null,
  sort int not null default 1
);

create index if not exists idx_offers_type on public.offers(type);
create index if not exists idx_offer_details_offer_id on public.offer_details(offer_id);
create index if not exists idx_offer_details_station_id on public.offer_details(station_id);
create index if not exists idx_offer_details_sort on public.offer_details(offer_id, sort);

alter table public.offer_types enable row level security;
alter table public.offers enable row level security;
alter table public.offer_details enable row level security;

drop policy if exists "Public can read offer types" on public.offer_types;
create policy "Public can read offer types"
  on public.offer_types
  for select
  using (true);

drop policy if exists "Authenticated users can manage offer types" on public.offer_types;
create policy "Authenticated users can manage offer types"
  on public.offer_types
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Public can read offers" on public.offers;
create policy "Public can read offers"
  on public.offers
  for select
  using (true);

drop policy if exists "Authenticated users can manage offers" on public.offers;
create policy "Authenticated users can manage offers"
  on public.offers
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Public can read offer details" on public.offer_details;
create policy "Public can read offer details"
  on public.offer_details
  for select
  using (true);

drop policy if exists "Authenticated users can manage offer details" on public.offer_details;
create policy "Authenticated users can manage offer details"
  on public.offer_details
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
