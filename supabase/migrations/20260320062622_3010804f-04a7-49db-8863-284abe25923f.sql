
-- Create scheduling_type enum
DO $$ BEGIN
  CREATE TYPE public.scheduling_type AS ENUM ('slots', 'instant', 'daily');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Create booking_status enum
DO $$ BEGIN
  CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Stations table
CREATE TABLE public.stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  working_hours_start time NOT NULL DEFAULT '08:00',
  working_hours_end time NOT NULL DEFAULT '22:00',
  slot_duration_minutes integer NOT NULL DEFAULT 30,
  scheduling_type scheduling_type NOT NULL DEFAULT 'slots',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access stations" ON public.stations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon read stations" ON public.stations FOR SELECT TO anon USING (true);

-- Services table
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid REFERENCES public.stations(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  duration_minutes integer NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access services" ON public.services FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon read services" ON public.services FOR SELECT TO anon USING (true);

-- Bookings table
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number serial,
  customer_phone text NOT NULL,
  customer_name text,
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  booking_date date NOT NULL,
  booking_time time,
  status booking_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access bookings" ON public.bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role insert bookings" ON public.bookings FOR INSERT TO service_role WITH CHECK (true);

-- Bot sessions table
CREATE TABLE public.bot_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone text NOT NULL UNIQUE,
  current_step text NOT NULL DEFAULT 'idle',
  selected_station_id uuid REFERENCES public.stations(id) ON DELETE SET NULL,
  selected_service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  selected_date date,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bot_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access bot_sessions" ON public.bot_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role all bot_sessions" ON public.bot_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Bot settings in app_settings
INSERT INTO public.app_settings (key, value) VALUES ('BOT_ENABLED', 'true') ON CONFLICT DO NOTHING;
INSERT INTO public.app_settings (key, value) VALUES ('BOT_WELCOME_MESSAGE', 'مرحباً بك في خدمة غسيل السيارات! 🚗✨') ON CONFLICT DO NOTHING;
