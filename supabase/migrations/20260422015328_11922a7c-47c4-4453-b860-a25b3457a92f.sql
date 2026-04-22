-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule existing job if present (idempotent)
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'process-scheduled-reminders';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

-- Schedule the job to run every 5 minutes
SELECT cron.schedule(
  'process-scheduled-reminders',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lrouvlmandrjughswbyw.supabase.co/functions/v1/process-scheduled-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxyb3V2bG1hbmRyanVnaHN3Ynl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NjQyNjQsImV4cCI6MjA4NTQ0MDI2NH0.DgjFcC96TMGlPMfTu9sqB8U6ORglJXxZcML3kMdyiP0"}'::jsonb,
    body := concat('{"trigger":"cron","time":"', now(), '"}')::jsonb
  ) AS request_id;
  $$
);