-- Simplify triggers: since send-push has verify_jwt=false, we only need the URL
-- Use the anon key (which is public) for the Authorization header

CREATE OR REPLACE FUNCTION public.notify_push_on_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sender_name TEXT;
  v_participant RECORD;
  v_supabase_url TEXT;
BEGIN
  SELECT value #>> '{}' INTO v_supabase_url
  FROM public.system_settings WHERE key = 'supabase_url';

  IF v_supabase_url IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_sender_name
  FROM public.profiles
  WHERE user_id = NEW.sender_id
  LIMIT 1;

  FOR v_participant IN
    SELECT user_id FROM public.conversation_participants
    WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.sender_id
  LOOP
    PERFORM extensions.http_post(
      url := v_supabase_url || '/functions/v1/send-push',
      body := json_build_object(
        'recipientUserId', v_participant.user_id,
        'title', COALESCE(v_sender_name, 'New Message'),
        'body', LEFT(NEW.content, 100),
        'url', '/messages'
      )::text,
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  END LOOP;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_push_on_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_supabase_url TEXT;
BEGIN
  SELECT value #>> '{}' INTO v_supabase_url
  FROM public.system_settings WHERE key = 'supabase_url';

  IF v_supabase_url IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    url := v_supabase_url || '/functions/v1/send-push',
    body := json_build_object(
      'recipientUserId', NEW.user_id,
      'title', NEW.title,
      'body', LEFT(NEW.message, 150),
      'url', COALESCE(NEW.action_url, '/notifications')
    )::text,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$function$;
