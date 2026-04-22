-- 1. Drop existing CHECK constraints if they restrict status values
ALTER TABLE public.email_send_log DROP CONSTRAINT IF EXISTS email_send_log_status_check;
ALTER TABLE public.telegram_send_log DROP CONSTRAINT IF EXISTS telegram_send_log_status_check;

-- 2. Add new CHECK constraints that include 'dry_run'
ALTER TABLE public.email_send_log
  ADD CONSTRAINT email_send_log_status_check
  CHECK (status IN ('pending', 'sent', 'failed', 'dlq', 'bounced', 'complained', 'suppressed', 'dry_run'));

ALTER TABLE public.telegram_send_log
  ADD CONSTRAINT telegram_send_log_status_check
  CHECK (status IN ('pending', 'sent', 'failed', 'dlq', 'suppressed', 'dry_run'));

-- 3. Update unique index on email_send_log to exclude dry_run rows
DROP INDEX IF EXISTS public.uniq_email_log_pending_per_message;
CREATE UNIQUE INDEX uniq_email_log_pending_per_message
  ON public.email_send_log (message_id)
  WHERE status = 'pending';

-- 4. Add indexes on metadata->>'smoke_test' to speed up filtering
CREATE INDEX IF NOT EXISTS idx_email_send_log_smoke_test
  ON public.email_send_log ((metadata->>'smoke_test'))
  WHERE metadata ? 'smoke_test';

CREATE INDEX IF NOT EXISTS idx_telegram_send_log_smoke_test
  ON public.telegram_send_log ((metadata->>'smoke_test'))
  WHERE metadata ? 'smoke_test';

-- 5. Add index on status for faster dry_run filtering
CREATE INDEX IF NOT EXISTS idx_email_send_log_status_created
  ON public.email_send_log (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telegram_send_log_status_created
  ON public.telegram_send_log (status, created_at DESC);