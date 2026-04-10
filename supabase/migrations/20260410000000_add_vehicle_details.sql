-- Add vehicle_details to bookings for customer car info
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS vehicle_details text;

-- Add selected_time to bot_sessions to persist time between steps
-- Add vehicle_details to bot_sessions for temp storage during booking flow
ALTER TABLE public.bot_sessions
  ADD COLUMN IF NOT EXISTS selected_time text,
  ADD COLUMN IF NOT EXISTS vehicle_details text;
