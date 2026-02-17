
-- Create a trigger function that calls the send-push edge function on new messages
CREATE OR REPLACE FUNCTION public.notify_push_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_recipient_id UUID;
  v_sender_name TEXT;
  v_participant RECORD;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  -- Get the Supabase URL and service role key from vault or config
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);

  -- If we can't get the URL, skip push (it's optional)
  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get sender name
  SELECT full_name INTO v_sender_name
  FROM public.profiles
  WHERE user_id = NEW.sender_id
  LIMIT 1;

  -- Notify all other participants
  FOR v_participant IN
    SELECT user_id FROM public.conversation_participants
    WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.sender_id
  LOOP
    -- Use pg_net to call the edge function asynchronously
    PERFORM extensions.http_post(
      url := v_supabase_url || '/functions/v1/send-push',
      body := json_build_object(
        'recipientUserId', v_participant.user_id,
        'title', COALESCE(v_sender_name, 'New Message'),
        'body', LEFT(NEW.content, 100),
        'url', '/messages'
      )::text,
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      )::jsonb
    );
  END LOOP;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail message insert if push fails
    RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_message_send_push
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_on_message();
