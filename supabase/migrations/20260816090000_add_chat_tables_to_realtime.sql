-- postgres_changes subscriptions (used by the owner portal's chat tab, and
-- notifications bell counts) only fire for tables added to the
-- supabase_realtime publication -- it is not FOR ALL TABLES in this project.
-- conversations/messages were added when the WhatsApp bot audit log was
-- built (see 20260319130301_*.sql); the new chat tables need the same.
alter publication supabase_realtime add table public.chat_threads;
alter publication supabase_realtime add table public.chat_thread_members;
alter publication supabase_realtime add table public.chat_messages;
