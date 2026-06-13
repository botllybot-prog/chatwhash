create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  role text not null check (role in ('customer', 'owner')),
  token text not null,
  platform text not null check (platform in ('android', 'ios')),
  language text not null default 'ar' check (language in ('ar', 'en', 'ku')),
  created_at timestamptz not null default now(),
  unique (phone, role, platform)
);

alter table public.device_tokens enable row level security;

drop policy if exists "Service role full access" on public.device_tokens;

create policy "Service role full access"
  on public.device_tokens
  for all
  to service_role
  using (true)
  with check (true);

create index if not exists idx_device_tokens_phone_role
  on public.device_tokens(phone, role);
