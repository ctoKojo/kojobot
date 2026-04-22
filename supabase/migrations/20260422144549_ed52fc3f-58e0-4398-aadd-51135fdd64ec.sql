
-- 1. Backup pending + failed logs before any cleanup
CREATE TABLE IF NOT EXISTS public.email_send_log_archive_2026_04 AS
SELECT * FROM public.email_send_log
WHERE status IN ('pending', 'failed');

ALTER TABLE public.email_send_log_archive_2026_04 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email log archive"
ON public.email_send_log_archive_2026_04
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. Deduplicate pending rows: keep oldest, mark duplicates as failed (stale_test_cleanup)
WITH ranked AS (
  SELECT id, message_id,
         ROW_NUMBER() OVER (PARTITION BY message_id ORDER BY created_at ASC) AS rn
  FROM public.email_send_log
  WHERE status = 'pending' AND message_id IS NOT NULL
)
UPDATE public.email_send_log e
SET status = 'failed',
    error_message = 'duplicate_pending_cleanup_sprint1'
FROM ranked r
WHERE e.id = r.id AND r.rn > 1;

-- 3. Unique partial index (now safe after dedup)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_email_log_pending_per_message
ON public.email_send_log (message_id)
WHERE status = 'pending' AND message_id IS NOT NULL;

-- 4. Performance indexes for health dashboard
CREATE INDEX IF NOT EXISTS idx_email_send_log_status_created
ON public.email_send_log (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telegram_send_log_status_created
ON public.telegram_send_log (status, created_at DESC);
