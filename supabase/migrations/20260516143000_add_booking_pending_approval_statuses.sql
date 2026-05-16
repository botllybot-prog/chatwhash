alter type public.booking_status add value if not exists 'pending_owner_approval';
alter type public.booking_status add value if not exists 'pending_customer_approval';
