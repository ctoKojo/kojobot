ALTER TABLE public.job_interviews
  ADD COLUMN IF NOT EXISTS confirm_token text,
  ADD COLUMN IF NOT EXISTS applicant_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS applicant_decision_at timestamptz,
  ADD COLUMN IF NOT EXISTS reschedule_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS reschedule_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_by_applicant_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_reason text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_job_interviews_confirm_token ON public.job_interviews(confirm_token) WHERE confirm_token IS NOT NULL;

UPDATE public.job_interviews
SET confirm_token = encode(gen_random_bytes(24), 'hex')
WHERE confirm_token IS NULL;