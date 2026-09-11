-- Every new customer (first customer_profiles row, written by
-- customer-login-by-phone on their first completed login) is auto-joined to
-- every existing group chat thread. Mirrors sync_chat_direct_thread_members's
-- pattern for direct threads. Only fires on INSERT, so returning customers
-- (upserted on every login) are left alone -- they're already members of
-- whatever groups they were added to.
create or replace function public.add_new_customer_to_group_threads()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chat_thread_members (thread_id, customer_phone)
  select id, new.customer_phone
  from public.chat_threads
  where kind = 'group'
  on conflict (thread_id, customer_phone) do nothing;
  return new;
end;
$$;

create trigger trg_add_new_customer_to_group_threads
  after insert on public.customer_profiles
  for each row execute function public.add_new_customer_to_group_threads();
