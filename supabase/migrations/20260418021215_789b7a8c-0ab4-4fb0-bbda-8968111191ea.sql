
-- Auto-resolve no_reply warnings when instructor replies in the conversation
CREATE OR REPLACE FUNCTION public.auto_resolve_no_reply_warning()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a message is inserted, check if sender has any active no_reply warning for this conversation
  UPDATE public.instructor_warnings
  SET is_active = false,
      resolved_at = now(),
      resolved_reason = 'auto: instructor replied to conversation'
  WHERE warning_type = 'no_reply'
    AND is_active = true
    AND instructor_id = NEW.sender_id
    AND reference_type = 'conversation'
    AND reference_id::uuid = NEW.conversation_id;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS z_auto_resolve_no_reply_on_message ON public.messages;
CREATE TRIGGER z_auto_resolve_no_reply_on_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.auto_resolve_no_reply_warning();

-- Backfill: resolve Fares's existing warning since he already replied
UPDATE public.instructor_warnings iw
SET is_active = false,
    resolved_at = now(),
    resolved_reason = 'auto: instructor replied to conversation (backfill)'
WHERE iw.warning_type = 'no_reply'
  AND iw.is_active = true
  AND iw.reference_type = 'conversation'
  AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.conversation_id = iw.reference_id::uuid
      AND m.sender_id = iw.instructor_id
      AND m.created_at > iw.created_at
  );
