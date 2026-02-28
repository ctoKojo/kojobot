
-- Chatbot conversations table
CREATE TABLE public.chatbot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'محادثة جديدة',
  level_id UUID REFERENCES public.levels(id),
  age_group_id UUID REFERENCES public.age_groups(id),
  last_message_at TIMESTAMPTZ DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  summary TEXT,
  persona TEXT NOT NULL DEFAULT 'kojo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chatbot messages table
CREATE TABLE public.chatbot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chatbot_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tokens_estimate INTEGER,
  sources_used JSONB,
  safety_flags JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_chatbot_conversations_student ON public.chatbot_conversations(student_id);
CREATE INDEX idx_chatbot_conversations_last_msg ON public.chatbot_conversations(last_message_at DESC);
CREATE INDEX idx_chatbot_messages_conversation ON public.chatbot_messages(conversation_id, created_at);

-- Enable RLS
ALTER TABLE public.chatbot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for conversations
CREATE POLICY "Students can view own conversations"
  ON public.chatbot_conversations FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can create own conversations"
  ON public.chatbot_conversations FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update own conversations"
  ON public.chatbot_conversations FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can delete own conversations"
  ON public.chatbot_conversations FOR DELETE
  TO authenticated
  USING (student_id = auth.uid());

-- Admins can view all conversations (for monitoring safety_flags)
CREATE POLICY "Admins can view all conversations"
  ON public.chatbot_conversations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for messages
CREATE POLICY "Students can view own messages"
  ON public.chatbot_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chatbot_conversations c
      WHERE c.id = conversation_id AND c.student_id = auth.uid()
    )
  );

CREATE POLICY "Students can insert own messages"
  ON public.chatbot_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chatbot_conversations c
      WHERE c.id = conversation_id AND c.student_id = auth.uid()
    )
  );

-- Admins can view all messages
CREATE POLICY "Admins can view all messages"
  ON public.chatbot_messages FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for conversations (for sidebar updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.chatbot_conversations;
