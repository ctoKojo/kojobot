
-- ============================================================
-- Compliance Monitor V2 — DB Foundations + Auto-Resolve Triggers
-- ============================================================

-- 1) instructor_warnings: add resolved_at + updated_at + index
ALTER TABLE public.instructor_warnings
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Index for fast auto-resolve lookups (gap #4)
CREATE INDEX IF NOT EXISTS idx_warnings_session_type_active
  ON public.instructor_warnings(session_id, warning_type)
  WHERE is_active = true;

-- 2) sessions: add last_compliance_scan_at for anti-starvation batching (gap #6)
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS last_compliance_scan_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sessions_compliance_scan
  ON public.sessions(last_compliance_scan_at NULLS FIRST, session_date ASC)
  WHERE status IN ('completed', 'scheduled');

-- 3) compliance_scan_runs: metrics & audit log
CREATE TABLE IF NOT EXISTS public.compliance_scan_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_type TEXT NOT NULL DEFAULT 'compliance-monitor',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  execution_time_ms INTEGER,
  sessions_scanned INTEGER DEFAULT 0,
  warnings_created INTEGER DEFAULT 0,
  warnings_skipped INTEGER DEFAULT 0,
  warnings_auto_resolved INTEGER DEFAULT 0,
  avg_scan_lag_seconds INTEGER,
  errors JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.compliance_scan_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read scan runs"
  ON public.compliance_scan_runs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_scan_runs_started
  ON public.compliance_scan_runs(started_at DESC);

-- 4) Backup of current warnings (gap #8 — safety before bulk ops)
CREATE TABLE IF NOT EXISTS public.instructor_warnings_backup_20260418 AS
  SELECT * FROM public.instructor_warnings;

-- 5) Auto-resolve trigger function (generic) — gap #9
CREATE OR REPLACE FUNCTION public.auto_resolve_warning(
  p_session_id UUID,
  p_warning_type TEXT,
  p_reason TEXT DEFAULT 'auto_resolved_condition_met'
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_session_id IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.instructor_warnings
  SET is_active = false,
      resolved_at = now(),
      resolved_reason = p_reason,
      updated_at = now()
  WHERE session_id = p_session_id
    AND warning_type = p_warning_type
    AND is_active = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 5a) Trigger: quiz assignment created → resolve no_quiz
CREATE OR REPLACE FUNCTION public.trg_resolve_no_quiz_warning()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    PERFORM public.auto_resolve_warning(NEW.session_id, 'no_quiz', 'quiz_assigned');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_resolve_no_quiz ON public.quiz_assignments;
CREATE TRIGGER auto_resolve_no_quiz
  AFTER INSERT ON public.quiz_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_resolve_no_quiz_warning();

-- 5b) Trigger: assignment created → resolve no_assignment
CREATE OR REPLACE FUNCTION public.trg_resolve_no_assignment_warning()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    PERFORM public.auto_resolve_warning(NEW.session_id, 'no_assignment', 'assignment_created');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_resolve_no_assignment ON public.assignments;
CREATE TRIGGER auto_resolve_no_assignment
  AFTER INSERT ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_resolve_no_assignment_warning();

-- 5c) Trigger: attendance recorded → resolve no_attendance
CREATE OR REPLACE FUNCTION public.trg_resolve_no_attendance_warning()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    PERFORM public.auto_resolve_warning(NEW.session_id, 'no_attendance', 'attendance_recorded');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_resolve_no_attendance ON public.attendance;
CREATE TRIGGER auto_resolve_no_attendance
  AFTER INSERT ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_resolve_no_attendance_warning();

-- 5d) Trigger: session_evaluation created → resolve no_evaluation
-- Only resolve if all present students are now evaluated
CREATE OR REPLACE FUNCTION public.trg_resolve_no_evaluation_warning()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_present_count INTEGER;
  v_evaluated_count INTEGER;
BEGIN
  IF NEW.session_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_present_count
  FROM public.attendance
  WHERE session_id = NEW.session_id AND status = 'present';

  SELECT COUNT(DISTINCT student_id) INTO v_evaluated_count
  FROM public.session_evaluations
  WHERE session_id = NEW.session_id;

  -- If all present students are evaluated → resolve
  IF v_present_count > 0 AND v_evaluated_count >= v_present_count THEN
    PERFORM public.auto_resolve_warning(NEW.session_id, 'no_evaluation', 'all_students_evaluated');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_resolve_no_evaluation ON public.session_evaluations;
CREATE TRIGGER auto_resolve_no_evaluation
  AFTER INSERT ON public.session_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_resolve_no_evaluation_warning();

-- 6) updated_at maintenance trigger for instructor_warnings
CREATE OR REPLACE FUNCTION public.touch_instructor_warnings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_instructor_warnings_updated_at ON public.instructor_warnings;
CREATE TRIGGER trg_touch_instructor_warnings_updated_at
  BEFORE UPDATE ON public.instructor_warnings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_instructor_warnings_updated_at();
