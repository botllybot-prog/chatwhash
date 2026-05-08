ALTER TABLE public.quick_booking_requests
  ADD COLUMN IF NOT EXISTS timeout_notified boolean NOT NULL DEFAULT false;

ALTER TABLE public.bot_sessions
  ADD COLUMN IF NOT EXISTS timeout_request_id uuid REFERENCES public.quick_booking_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rating_booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS rating_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rating_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_rating integer,
  ADD COLUMN IF NOT EXISTS rated_at timestamptz;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_customer_rating_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_customer_rating_check
  CHECK (customer_rating IS NULL OR customer_rating BETWEEN 1 AND 5);

UPDATE public.bookings
SET rating_requested = true
WHERE rating_requested = false
  AND status = 'confirmed'
  AND (
    booking_date < CURRENT_DATE
    OR (
      booking_date = CURRENT_DATE
      AND booking_time IS NOT NULL
      AND booking_time < (CURRENT_TIME - interval '1 hour')
    )
  );

CREATE INDEX IF NOT EXISTS idx_quick_booking_requests_timeout
  ON public.quick_booking_requests(status, timeout_notified, created_at);

CREATE INDEX IF NOT EXISTS idx_bookings_rating_requested
  ON public.bookings(status, rating_requested, booking_date, booking_time);
