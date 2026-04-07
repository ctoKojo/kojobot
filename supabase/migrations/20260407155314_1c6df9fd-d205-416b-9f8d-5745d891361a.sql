
-- =============================================
-- Phase 1: Drop redundant index
-- =============================================
DROP INDEX IF EXISTS idx_sessions_group_session_number_unique;

-- =============================================
-- Phase 2: Add RLS policies for chatbot_rate_limits
-- =============================================
CREATE POLICY "Students can insert own rate limits"
ON public.chatbot_rate_limits FOR INSERT TO authenticated
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can read own rate limits"
ON public.chatbot_rate_limits FOR SELECT TO authenticated
USING (student_id = auth.uid());

CREATE POLICY "Students can update own rate limits"
ON public.chatbot_rate_limits FOR UPDATE TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

-- =============================================
-- Phase 3: Guarantee trigger execution order
-- Rename trg_check_level_completion → b_check_level_completion
-- so order becomes: a_ (assign content) → b_ (check level) → on_ (generate next)
-- This ensures level completion check runs BEFORE next session generation
-- =============================================
DROP TRIGGER IF EXISTS trg_check_level_completion ON public.sessions;

CREATE TRIGGER b_check_level_completion
  AFTER UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION check_students_level_completion();
