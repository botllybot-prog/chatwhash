-- Denormalized display name for the message sender, populated at insert
-- time (customer_web_sessions.customer_name for customers, station_owners.
-- owner_name for owners) so message lists don't need a join/lookup per
-- sender_id on every read -- same pattern as customer_notifications storing
-- title/body directly instead of referencing another table.
alter table public.chat_messages
  add column if not exists sender_name text;
