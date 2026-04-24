ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS customer_discount text;
