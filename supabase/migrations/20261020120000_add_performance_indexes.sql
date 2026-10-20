-- Indexes for the hottest read paths, which previously scanned whole tables.

-- Owner portal: bookings for one station, newest first (also realtime reloads).
create index if not exists idx_bookings_station_created_at
  on public.bookings(station_id, created_at desc);

-- Admin dashboard / reports: bookings by day and status.
create index if not exists idx_bookings_booking_date_status
  on public.bookings(booking_date, status);

-- Customer inbox and booking lookups by phone (customer-get-inbox etc.).
create index if not exists idx_bookings_customer_phone
  on public.bookings(customer_phone);

-- Notification bell / sidebar counts: a user's notifications, newest first.
create index if not exists idx_notifications_user_created_at
  on public.notifications(user_id, created_at desc);

create index if not exists idx_notifications_user_unread
  on public.notifications(user_id)
  where is_read = false;
