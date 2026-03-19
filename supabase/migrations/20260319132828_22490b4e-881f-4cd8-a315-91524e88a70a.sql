
-- Update RLS for app_settings: only authenticated users
DROP POLICY IF EXISTS "Allow all insert" ON public.app_settings;
DROP POLICY IF EXISTS "Allow all read" ON public.app_settings;
DROP POLICY IF EXISTS "Allow all update" ON public.app_settings;

CREATE POLICY "Authenticated read" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update" ON public.app_settings FOR UPDATE TO authenticated USING (true);

-- Update RLS for conversations: only authenticated users
DROP POLICY IF EXISTS "Allow all access to conversations" ON public.conversations;

CREATE POLICY "Authenticated access conversations" ON public.conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Update RLS for messages: only authenticated users  
DROP POLICY IF EXISTS "Allow all access to messages" ON public.messages;

CREATE POLICY "Authenticated access messages" ON public.messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Keep service_role access for edge functions (anon key with service role)
-- Edge functions use service role key so they bypass RLS automatically
