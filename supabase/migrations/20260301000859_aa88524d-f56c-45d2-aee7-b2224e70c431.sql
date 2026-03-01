ALTER TABLE public.chatbot_conversations
  ADD COLUMN current_step TEXT DEFAULT NULL,
  ADD COLUMN last_kojo_question TEXT DEFAULT NULL;