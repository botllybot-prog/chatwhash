CREATE TABLE IF NOT EXISTS public.quick_booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  service_kind text NOT NULL,
  booking_date date NOT NULL,
  booking_time time NOT NULL,
  customer_lat double precision,
  customer_lng double precision,
  status text NOT NULL DEFAULT 'pending',
  chosen_station_id uuid REFERENCES public.stations(id) ON DELETE SET NULL,
  chosen_booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quick_booking_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.quick_booking_requests(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  distance_km numeric(10,2) NOT NULL DEFAULT 0,
  state text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quick_booking_requests_phone
  ON public.quick_booking_requests(customer_phone);

CREATE INDEX IF NOT EXISTS idx_quick_booking_targets_request
  ON public.quick_booking_targets(request_id);

ALTER TABLE public.quick_booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_booking_targets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quick_booking_requests'
      AND policyname = 'Service role all quick_booking_requests'
  ) THEN
    CREATE POLICY "Service role all quick_booking_requests"
      ON public.quick_booking_requests
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quick_booking_targets'
      AND policyname = 'Service role all quick_booking_targets'
  ) THEN
    CREATE POLICY "Service role all quick_booking_targets"
      ON public.quick_booking_targets
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

