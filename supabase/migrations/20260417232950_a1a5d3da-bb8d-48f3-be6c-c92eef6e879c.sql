-- Reschedule cron jobs to call edge functions using the publishable (anon) key in Authorization
-- (required by Supabase Functions gateway) plus an x-cron-secret header that the functions check.
-- The functions already validate either SERVICE_ROLE token OR CRON_SECRET in Authorization header.
-- We pass the CRON_SECRET in Authorization directly via a DB setting that the user seeds once.

-- Drop old schedules
DO $$
DECLARE j RECORD;
BEGIN
  FOR j IN SELECT jobname FROM cron.job
           WHERE jobname IN ('auto-complete-sessions','compliance-monitor','session-reminders')
  LOOP
    PERFORM cron.unschedule(j.jobname);
  END LOOP;
END $$;

-- Helper: store cron secret in a private table (only superuser/cron can read)
CREATE TABLE IF NOT EXISTS private_cron_config (
  key text PRIMARY KEY,
  value text NOT NULL
);
REVOKE ALL ON private_cron_config FROM PUBLIC, anon, authenticated;
ALTER TABLE private_cron_config ENABLE ROW LEVEL SECURITY;
-- No policies = no client access. Only superuser/cron can read it.

-- Reschedule with bearer token from private_cron_config
SELECT cron.schedule(
  'auto-complete-sessions',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lrouvlmandrjughswbyw.supabase.co/functions/v1/auto-complete-sessions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT value FROM private_cron_config WHERE key = 'cron_secret'), '')
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'compliance-monitor',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lrouvlmandrjughswbyw.supabase.co/functions/v1/compliance-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT value FROM private_cron_config WHERE key = 'cron_secret'), '')
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'session-reminders',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lrouvlmandrjughswbyw.supabase.co/functions/v1/session-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((SELECT value FROM private_cron_config WHERE key = 'cron_secret'), '')
    ),
    body := '{}'::jsonb
  );
  $$
);