CREATE TABLE IF NOT EXISTS public.bot_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  name TEXT,
  platform TEXT NOT NULL DEFAULT 'whatsapp',
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  total_bookings INTEGER DEFAULT 0,
  last_booking_at TIMESTAMPTZ,
  is_blocked BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(phone, platform)
);

ALTER TABLE public.bot_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to bot_customers" ON public.bot_customers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_bot_customers_phone ON public.bot_customers(phone);
CREATE INDEX IF NOT EXISTS idx_bot_customers_platform ON public.bot_customers(platform);
CREATE INDEX IF NOT EXISTS idx_bot_customers_last_seen ON public.bot_customers(last_seen_at DESC);
