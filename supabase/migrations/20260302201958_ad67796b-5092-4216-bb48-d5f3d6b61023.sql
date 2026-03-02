ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS attendance_mode text DEFAULT NULL;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS session_link text DEFAULT NULL;