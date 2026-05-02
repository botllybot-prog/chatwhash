ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS booking_language text NOT NULL DEFAULT 'ar';

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_booking_language_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_booking_language_check
  CHECK (booking_language IN ('ar', 'en', 'ku', 'tr'));

ALTER TABLE public.quick_booking_requests
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'ar';

ALTER TABLE public.quick_booking_requests
  DROP CONSTRAINT IF EXISTS quick_booking_requests_language_check;

ALTER TABLE public.quick_booking_requests
  ADD CONSTRAINT quick_booking_requests_language_check
  CHECK (language IN ('ar', 'en', 'ku', 'tr'));

