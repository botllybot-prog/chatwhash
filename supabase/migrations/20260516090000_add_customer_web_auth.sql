create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  customer_phone text not null unique,
  customer_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_login_codes (
  id uuid primary key default gen_random_uuid(),
  customer_phone text not null,
  code text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_customer_login_codes_phone_created
  on public.customer_login_codes(customer_phone, created_at desc);

create table if not exists public.customer_web_sessions (
  id uuid primary key default gen_random_uuid(),
  customer_phone text not null,
  customer_name text not null,
  session_token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_customer_web_sessions_phone
  on public.customer_web_sessions(customer_phone);
