alter table if exists public.customer_profiles
  add column if not exists is_blocked boolean not null default false,
  add column if not exists blocked_reason text,
  add column if not exists blocked_at timestamptz;

create index if not exists idx_customer_profiles_is_blocked
  on public.customer_profiles(is_blocked);
