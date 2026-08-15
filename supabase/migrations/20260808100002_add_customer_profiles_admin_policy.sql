-- customer_profiles has row level security enabled on the live database (not
-- via any tracked migration -- likely enabled directly against the DB at some
-- point) but had zero policies, which means default-deny: every authenticated
-- read silently returned empty instead of erroring. This broke the existing
-- Bot Customers admin page (AdminCustomers.tsx) and the new chat-groups
-- customer picker, both of which query this table directly from the browser.
--
-- Customers themselves are unaffected either way -- they never query this
-- table directly, only through service-role edge functions.
create policy "Admins can read customer profiles" on public.customer_profiles
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can update customer profiles" on public.customer_profiles
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
