ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS spin_discount_percent integer NOT NULL DEFAULT 0;

ALTER TABLE public.bookings
DROP CONSTRAINT IF EXISTS bookings_spin_discount_percent_check;

ALTER TABLE public.bookings
ADD CONSTRAINT bookings_spin_discount_percent_check
CHECK (spin_discount_percent IN (0, 5, 10, 15));
