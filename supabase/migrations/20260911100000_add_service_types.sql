-- Admin-managed service types, replacing the per-service duration_minutes
-- field: services are now categorized by type instead of tracked by time.
-- (Scheduling itself was never driven by services.duration_minutes -- that's
-- stations.slot_duration_minutes -- so this is a pure re-categorization.)
create table if not exists public.service_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp with time zone not null default now()
);

alter table public.services
  add column if not exists service_type_id uuid references public.service_types(id) on delete set null;

create index if not exists idx_services_service_type_id on public.services(service_type_id);

alter table public.services drop column if exists duration_minutes;

alter table public.service_types enable row level security;

drop policy if exists "Public can read service types" on public.service_types;
create policy "Public can read service types"
  on public.service_types
  for select
  using (true);

drop policy if exists "Admins can manage service types" on public.service_types;
create policy "Admins can manage service types"
  on public.service_types
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
