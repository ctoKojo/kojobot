-- Trigger immediate compliance scan to process the newly backfilled makeup sessions for instructor Mahmoud Zaki
SELECT net.http_post(
  url := 'https://lrouvlmandrjughswbyw.supabase.co/functions/v1/compliance-monitor',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || public.private_get_cron_secret()
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 60000
);