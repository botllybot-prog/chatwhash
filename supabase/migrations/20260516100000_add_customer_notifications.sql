create table if not exists public.customer_notifications (
  id uuid primary key default gen_random_uuid(),
  customer_phone text not null,
  title text not null,
  body text not null,
  is_read boolean not null default false,
  reference_booking_id uuid references public.bookings(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_customer_notifications_phone_created
  on public.customer_notifications(customer_phone, created_at desc);
