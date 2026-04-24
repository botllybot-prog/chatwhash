
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.app_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.app_settings FOR UPDATE USING (true);

-- Auto-generate a verify token
INSERT INTO public.app_settings (key, value) VALUES ('WHATSAPP_VERIFY_TOKEN', encode(gen_random_bytes(24), 'hex'));
