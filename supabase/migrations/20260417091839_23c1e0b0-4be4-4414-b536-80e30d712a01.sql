-- Fix clone_curriculum failure: makeup_sessions FK was blocking deletion of target sessions during clone.
-- Change to ON DELETE SET NULL so historical makeup records are preserved without blocking curriculum operations.

ALTER TABLE public.makeup_sessions
  DROP CONSTRAINT IF EXISTS makeup_sessions_curriculum_session_id_fkey;

ALTER TABLE public.makeup_sessions
  ADD CONSTRAINT makeup_sessions_curriculum_session_id_fkey
  FOREIGN KEY (curriculum_session_id)
  REFERENCES public.curriculum_sessions(id)
  ON DELETE SET NULL;