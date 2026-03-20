
-- Step 1: Tighten RLS on bookings
DROP POLICY IF EXISTS "Authenticated access bookings" ON public.bookings;
DROP POLICY IF EXISTS "Service role insert bookings" ON public.bookings;

CREATE POLICY "Admins full access bookings" ON public.bookings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners read own station bookings" ON public.bookings FOR SELECT TO authenticated
  USING (station_id = public.get_owner_station_id(auth.uid()));

CREATE POLICY "Service role insert bookings" ON public.bookings FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role update bookings" ON public.bookings FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);

-- Step 2: Tighten RLS on services
DROP POLICY IF EXISTS "Authenticated access services" ON public.services;

CREATE POLICY "Admins full access services" ON public.services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners read own station services" ON public.services FOR SELECT TO authenticated
  USING (station_id IS NULL OR station_id = public.get_owner_station_id(auth.uid()));

-- Step 3: Tighten RLS on stations
DROP POLICY IF EXISTS "Authenticated access stations" ON public.stations;

CREATE POLICY "Admins full access stations" ON public.stations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners read own station" ON public.stations FOR SELECT TO authenticated
  USING (id = public.get_owner_station_id(auth.uid()));

-- Step 4: Tighten RLS on app_settings
DROP POLICY IF EXISTS "Authenticated insert" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated update" ON public.app_settings;

CREATE POLICY "Admins insert app_settings" ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update app_settings" ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Step 5: Tighten conversations & messages to admin only
DROP POLICY IF EXISTS "Authenticated access conversations" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated access messages" ON public.messages;

CREATE POLICY "Admins access conversations" ON public.conversations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins access messages" ON public.messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Step 6: Tighten bot_sessions to admin only  
DROP POLICY IF EXISTS "Authenticated access bot_sessions" ON public.bot_sessions;

CREATE POLICY "Admins access bot_sessions" ON public.bot_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
