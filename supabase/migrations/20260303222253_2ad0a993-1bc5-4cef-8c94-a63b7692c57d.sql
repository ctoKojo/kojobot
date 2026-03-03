ALTER TABLE chatbot_conversations
ADD COLUMN IF NOT EXISTS praise_flags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS concepts_mastered text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS summary_message_count integer DEFAULT 0;