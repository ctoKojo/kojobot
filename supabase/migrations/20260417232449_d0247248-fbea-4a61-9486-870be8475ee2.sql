-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- DB-level idempotency: prevent duplicate active warnings for the same session+type
CREATE UNIQUE INDEX IF NOT EXISTS uniq_warning_per_session_type
  ON public.instructor_warnings(session_id, warning_type)
  WHERE session_id IS NOT NULL AND is_active = true;

-- Unschedule existing jobs (safe re-run)
DO $$
DECLARE j RECORD;
BEGIN
  FOR j IN SELECT jobname FROM cron.job
           WHERE jobname IN ('auto-complete-sessions','compliance-monitor','session-reminders')
  LOOP
    PERFORM cron.unschedule(j.jobname);
  END LOOP;
END $$;

-- Schedule auto-complete-sessions every 15 minutes
SELECT cron.schedule(
  'auto-complete-sessions',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lrouvlmandrjughswbyw.supabase.co/functions/v1/auto-complete-sessions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Schedule compliance-monitor every hour at :00
SELECT cron.schedule(
  'compliance-monitor',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lrouvlmandrjughswbyw.supabase.co/functions/v1/compliance-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Schedule session-reminders every 30 minutes
-- Note: session-reminders requires admin role; we provide service-role key but the function
-- currently only allows admin user JWTs. We'll relax it later or rely on its own auth — for
-- now this scheduled call will no-op (return 403). Keeping the schedule as a placeholder.
SELECT cron.schedule(
  'session-reminders',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lrouvlmandrjughswbyw.supabase.co/functions/v1/session-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);