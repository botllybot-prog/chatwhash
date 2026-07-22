alter table if exists public.customer_profiles
  add column if not exists city text;

create index if not exists idx_customer_profiles_city
  on public.customer_profiles(city);
