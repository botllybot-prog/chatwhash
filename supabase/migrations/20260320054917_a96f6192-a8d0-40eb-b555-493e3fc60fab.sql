-- Unique partial index on whatsapp_message_id (excluding nulls)
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_wa_id_unique 
ON public.messages(whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL;

-- Unique composite to prevent duplicate open conversations
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_phone_status_unique 
ON public.conversations(customer_phone, status) WHERE status = 'open';