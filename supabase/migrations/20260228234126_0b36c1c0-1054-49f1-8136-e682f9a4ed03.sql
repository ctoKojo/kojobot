-- Allow students to delete their own chatbot messages
CREATE POLICY "Students can delete own messages"
ON public.chatbot_messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM chatbot_conversations c
    WHERE c.id = chatbot_messages.conversation_id
    AND c.student_id = auth.uid()
  )
);

-- Allow students to delete their own chatbot reports
CREATE POLICY "Students can delete own reports"
ON public.chatbot_reports
FOR DELETE
USING (student_id = auth.uid());