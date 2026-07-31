alter table public.offer_details
  add column if not exists media_key text,
  add column if not exists media_url text,
  add column if not exists media_type text,
  add column if not exists media_name text;
