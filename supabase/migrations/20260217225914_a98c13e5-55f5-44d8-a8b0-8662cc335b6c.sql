
-- 1. Create typing_indicators table
CREATE TABLE public.typing_indicators (
  user_id uuid NOT NULL,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id)
);

ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view typing indicators"
ON public.typing_indicators FOR SELECT
USING (is_conversation_participant(auth.uid(), conversation_id));

CREATE POLICY "Users can upsert their own typing indicator"
ON public.typing_indicators FOR INSERT
WITH CHECK (user_id = auth.uid() AND is_conversation_participant(auth.uid(), conversation_id));

CREATE POLICY "Users can update their own typing indicator"
ON public.typing_indicators FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own typing indicator"
ON public.typing_indicators FOR DELETE
USING (user_id = auth.uid());

-- 2. Add deleted_at column to messages
ALTER TABLE public.messages ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- 3. Enable realtime only for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;

-- 4. Enable realtime for conversations (use IF NOT EXISTS workaround)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
