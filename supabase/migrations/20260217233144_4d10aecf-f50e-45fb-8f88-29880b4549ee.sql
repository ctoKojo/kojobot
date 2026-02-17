
CREATE OR REPLACE FUNCTION public.notify_push_on_notification()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
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
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    )::jsonb
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$function$;

CREATE TRIGGER on_notification_send_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_on_notification();
