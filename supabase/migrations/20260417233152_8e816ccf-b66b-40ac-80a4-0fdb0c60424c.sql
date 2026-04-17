-- Rollback the previous insecure approach: drop the private_cron_config table
-- and reschedule cron jobs to use Supabase Vault for the CRON_SECRET.

-- 1. Drop old schedules
DO $$
DECLARE j RECORD;
BEGIN
  FOR j IN SELECT jobname FROM cron.job
           WHERE jobname IN ('auto-complete-sessions','compliance-monitor','session-reminders')
  LOOP
    PERFORM cron.unschedule(j.jobname);
  END LOOP;
END $$;

-- 2. Drop the insecure config table (if it exists)
DROP TABLE IF EXISTS public.private_cron_config;

-- 3. Ensure Vault extension is enabled (it is by default on Supabase, but just in case)
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- 4. Helper function: read cron_secret from Vault (SECURITY DEFINER, restricted)
-- Only callable by postgres/supabase_admin (used by cron jobs which run as superuser).
CREATE OR REPLACE FUNCTION private_get_cron_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = vault, public
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private_get_cron_secret() FROM PUBLIC, anon, authenticated;

-- 5. Reschedule the three cron jobs using Vault-backed Authorization Bearer header
SELECT cron.schedule(
  'auto-complete-sessions',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lrouvlmandrjughswbyw.supabase.co/functions/v1/auto-complete-sessions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || private_get_cron_secret()
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
      'Authorization', 'Bearer ' || private_get_cron_secret()
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
      'Authorization', 'Bearer ' || private_get_cron_secret()
    ),
    body := '{}'::jsonb
  );
  $$
);