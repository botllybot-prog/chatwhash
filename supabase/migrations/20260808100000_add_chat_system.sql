-- Chat system: customer <-> station owner direct threads, and admin-curated
-- group threads mixing owners and customers.
--
-- Customers have no Supabase Auth session (see customer_web_sessions), so
-- there are no RLS policies granting customer access here — customer-facing
-- edge functions use the service role key, which bypasses RLS entirely,
-- matching every other customer table in this schema (customer_profiles,
-- customer_web_sessions, customer_notifications).

create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'group')),
  name text,
  station_id uuid references public.stations(id) on delete cascade,
  last_message_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  created_by uuid references auth.users(id),
  constraint chat_threads_direct_has_station
    check (kind <> 'direct' or station_id is not null)
);

create unique index idx_chat_threads_direct_per_station
  on public.chat_threads(station_id)
  where kind = 'direct';

create index idx_chat_threads_kind on public.chat_threads(kind);

create table public.chat_thread_members (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  customer_phone text,
  added_at timestamp with time zone not null default now(),
  constraint chat_thread_members_exactly_one_participant
    check ((user_id is null) <> (customer_phone is null))
);

-- Plain (non-partial) unique constraints: Postgres never treats NULL = NULL
-- for uniqueness purposes, so multiple customer-only rows (user_id null) or
-- owner-only rows (customer_phone null) can coexist fine, while still
-- de-duplicating on the non-null side -- and unlike a partial unique index,
-- this is a valid ON CONFLICT target for the upserts the edge functions do.
alter table public.chat_thread_members
  add constraint chat_thread_members_unique_user unique (thread_id, user_id);

alter table public.chat_thread_members
  add constraint chat_thread_members_unique_customer unique (thread_id, customer_phone);

create index idx_chat_thread_members_user_id on public.chat_thread_members(user_id);
create index idx_chat_thread_members_customer_phone on public.chat_thread_members(customer_phone);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_type text not null check (sender_type in ('customer', 'owner', 'admin')),
  sender_id text not null,
  body text,
  media_key text,
  media_url text,
  media_type text,
  media_name text,
  created_at timestamp with time zone not null default now(),
  read_at timestamp with time zone,
  constraint chat_messages_body_or_media check (body is not null or media_url is not null)
);

create index idx_chat_messages_thread_id_created_at on public.chat_messages(thread_id, created_at);

alter table public.chat_threads enable row level security;
alter table public.chat_thread_members enable row level security;
alter table public.chat_messages enable row level security;

-- Security-definer helper avoids RLS self-recursion when a policy on
-- chat_thread_members needs to check membership of the same table, and lets
-- policies on chat_threads/chat_messages reuse the same check.
create or replace function public.is_chat_thread_member(_thread_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_thread_members
    where thread_id = _thread_id and user_id = _user_id
  )
$$;

-- RLS: chat_threads (owner/admin side only; customers go through edge functions)
create policy "Members can read their threads" on public.chat_threads
  for select to authenticated
  using (public.is_chat_thread_member(id, auth.uid()) or public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage threads" on public.chat_threads
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- RLS: chat_thread_members
create policy "Members can read their thread's roster" on public.chat_thread_members
  for select to authenticated
  using (public.is_chat_thread_member(thread_id, auth.uid()) or public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage thread membership" on public.chat_thread_members
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- RLS: chat_messages
create policy "Members can read their thread's messages" on public.chat_messages
  for select to authenticated
  using (public.is_chat_thread_member(thread_id, auth.uid()) or public.has_role(auth.uid(), 'admin'));

create policy "Members can send messages to their threads" on public.chat_messages
  for insert to authenticated
  with check (public.is_chat_thread_member(thread_id, auth.uid()) or public.has_role(auth.uid(), 'admin'));

-- Keep a 'direct' thread's membership synced to station_owners: whenever an
-- owner account is linked to or removed from a station, mirror that into
-- any existing direct thread for that station.
create or replace function public.sync_chat_direct_thread_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread_id uuid;
begin
  if tg_op = 'INSERT' then
    select id into v_thread_id from public.chat_threads
      where kind = 'direct' and station_id = new.station_id;
    if v_thread_id is not null then
      insert into public.chat_thread_members (thread_id, user_id)
        values (v_thread_id, new.user_id)
        on conflict do nothing;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    select id into v_thread_id from public.chat_threads
      where kind = 'direct' and station_id = old.station_id;
    if v_thread_id is not null then
      delete from public.chat_thread_members
        where thread_id = v_thread_id and user_id = old.user_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

create trigger trg_sync_chat_direct_thread_members
  after insert or delete on public.station_owners
  for each row execute function public.sync_chat_direct_thread_members();
