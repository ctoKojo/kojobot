-- Add new columns to jobs table
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS training_season TEXT CHECK (training_season IN ('summer', 'fall', 'winter', 'spring')),
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS content_language TEXT NOT NULL DEFAULT 'en' CHECK (content_language IN ('en', 'ar', 'both'));

-- Add comment for clarity
COMMENT ON COLUMN public.jobs.training_season IS 'Season of training: summer/fall/winter/spring. Only used when type is internship.';
COMMENT ON COLUMN public.jobs.is_paid IS 'Whether this job/training is paid.';
COMMENT ON COLUMN public.jobs.content_language IS 'Primary content language admin wrote in: en, ar, or both. UI uses this to show single-language fields when not both.';

-- Index for filtering by training season
CREATE INDEX IF NOT EXISTS idx_jobs_training_season ON public.jobs(training_season) WHERE training_season IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_is_paid ON public.jobs(is_paid);
