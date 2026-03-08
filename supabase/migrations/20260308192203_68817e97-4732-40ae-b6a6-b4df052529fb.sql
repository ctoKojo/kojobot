
-- Phase 1: Add new columns + backfill data
-- No triggers, no frontend, no edge functions changes

-- 1. Add columns with IF NOT EXISTS
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'groups' AND column_name = 'last_delivered_content_number'
  ) THEN
    ALTER TABLE public.groups ADD COLUMN last_delivered_content_number INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'groups' AND column_name = 'owed_sessions_count'
  ) THEN
    ALTER TABLE public.groups ADD COLUMN owed_sessions_count INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'content_number'
  ) THEN
    ALTER TABLE public.sessions ADD COLUMN content_number INTEGER;
  END IF;
END $$;

-- 2. Backfill content_number for regular completed sessions only
UPDATE public.sessions
SET content_number = session_number
WHERE status = 'completed'
  AND is_makeup IS NOT TRUE
  AND session_number IS NOT NULL
  AND content_number IS NULL;

-- 3. Update last_delivered_content_number for each group
UPDATE public.groups g
SET last_delivered_content_number = COALESCE(
  (SELECT MAX(s.content_number)
   FROM public.sessions s
   WHERE s.group_id = g.id
     AND s.status = 'completed'
     AND s.content_number IS NOT NULL),
  0
);
