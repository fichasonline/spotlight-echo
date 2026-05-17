-- Remove the anonymous AI chat entry point.
-- Visitors must start chats through create_support_thread_and_message,
-- which requires name, email, phone, and an initial message.

DROP FUNCTION IF EXISTS public.create_ai_chat_thread(TEXT, UUID);
