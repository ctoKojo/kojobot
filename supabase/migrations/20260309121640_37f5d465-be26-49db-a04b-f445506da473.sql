
-- ============================================================
-- 1. Fix RLS on placement_v2_attempts: students can only SELECT their own rows
--    (creation happens via Edge Function with service_role)
-- ============================================================

-- Drop existing student policies on placement_v2_attempts
DROP POLICY IF EXISTS "Students can manage own attempts" ON placement_v2_attempts;

-- Student can only READ their own attempts
CREATE POLICY "Students can read own attempts"
ON placement_v2_attempts FOR SELECT TO authenticated
USING (student_id = auth.uid());

-- ============================================================
-- 2. Fix RLS on placement_v2_attempt_questions: students can only SELECT
--    (updates happen via Edge Function with service_role)
-- ============================================================

DROP POLICY IF EXISTS "Students can manage own attempt questions" ON placement_v2_attempt_questions;

-- Student can only READ their own attempt questions
CREATE POLICY "Students can read own attempt questions"
ON placement_v2_attempt_questions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM placement_v2_attempts a
    WHERE a.id = attempt_id AND a.student_id = auth.uid()
  )
);

-- ============================================================
-- 3. Recreate placement_v2_student_view to hide results until finalized
--    Show recommended_level_id/approved_level_id ONLY when:
--    - status = 'reviewed', OR
--    - needs_manual_review = false AND status = 'submitted'
-- ============================================================

DROP VIEW IF EXISTS placement_v2_student_view;

CREATE VIEW placement_v2_student_view WITH (security_invoker = true) AS
SELECT
  id,
  student_id,
  status,
  attempt_number,
  started_at,
  submitted_at,
  -- Only show scores after submission
  CASE WHEN status IN ('submitted', 'reviewed') THEN section_a_score END AS section_a_score,
  CASE WHEN status IN ('submitted', 'reviewed') THEN section_a_max END AS section_a_max,
  CASE WHEN status IN ('submitted', 'reviewed') THEN section_b_score END AS section_b_score,
  CASE WHEN status IN ('submitted', 'reviewed') THEN section_b_max END AS section_b_max,
  -- Only show final result when no manual review needed, or after admin reviewed
  CASE
    WHEN status = 'reviewed' THEN COALESCE(approved_level_id, recommended_level_id)
    WHEN status = 'submitted' AND needs_manual_review = false THEN recommended_level_id
    ELSE NULL
  END AS final_level_id,
  CASE
    WHEN status = 'reviewed' THEN true
    WHEN status = 'submitted' AND needs_manual_review = false THEN true
    ELSE false
  END AS result_available,
  needs_manual_review,
  created_at
FROM placement_v2_attempts;

-- ============================================================
-- 4. Fix validate_placement_v2_schedule: prevent opens_at in the past too
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_placement_v2_schedule()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.opens_at >= NEW.closes_at THEN
    RAISE EXCEPTION 'opens_at must be before closes_at';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.opens_at < now() THEN
      RAISE EXCEPTION 'opens_at must be in the future';
    END IF;
    IF NEW.closes_at <= now() THEN
      RAISE EXCEPTION 'closes_at must be in the future';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. Prevent multiple in_progress attempts for the same student
--    Using a partial unique index (most robust approach)
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_in_progress_per_student
ON placement_v2_attempts (student_id)
WHERE status = 'in_progress';

-- ============================================================
-- 6. Document confidence logic as a DB function for Edge Function use
--    This makes the logic explicit, testable, and reusable
--
--    Logic:
--    - HIGH:  clear pass/fail on A&B (both >10% away from threshold)
--             AND track difference > 2 * track_margin
--    - LOW:   any section within 5% of threshold
--             OR inconsistent pattern (passed B but failed A)
--    - MEDIUM: everything else
-- ============================================================

CREATE OR REPLACE FUNCTION public.compute_placement_v2_confidence(
  p_section_a_pct NUMERIC,
  p_section_b_pct NUMERIC,
  p_sw_pct NUMERIC,
  p_hw_pct NUMERIC,
  p_pass_a INTEGER,
  p_pass_b INTEGER,
  p_track_margin INTEGER
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_margin_a NUMERIC;
  v_margin_b NUMERIC;
  v_track_diff NUMERIC;
  v_borderline_threshold NUMERIC := 5;  -- within 5% of pass = borderline
  v_inconsistent BOOLEAN;
BEGIN
  v_margin_a := ABS(p_section_a_pct - p_pass_a);
  v_margin_b := ABS(p_section_b_pct - p_pass_b);
  v_track_diff := ABS(p_sw_pct - p_hw_pct);

  -- Inconsistent: passed B but failed A (shouldn't happen normally)
  v_inconsistent := (p_section_b_pct >= p_pass_b AND p_section_a_pct < p_pass_a);

  -- LOW: borderline or inconsistent
  IF v_inconsistent THEN
    RETURN 'low';
  END IF;

  IF v_margin_a <= v_borderline_threshold OR v_margin_b <= v_borderline_threshold THEN
    RETURN 'low';
  END IF;

  -- If student reached section C evaluation, check track clarity
  IF p_section_a_pct >= p_pass_a AND p_section_b_pct >= p_pass_b THEN
    -- HIGH: clear section results AND clear track preference
    IF v_margin_a > 10 AND v_margin_b > 10 AND v_track_diff > (p_track_margin * 2) THEN
      RETURN 'high';
    END IF;
    -- Track is balanced/unclear = medium at best
    IF v_track_diff <= p_track_margin THEN
      RETURN 'medium';
    END IF;
    -- Moderate track difference
    RETURN 'medium';
  END IF;

  -- Student placed in Level 0 or Level 1 with clear margins
  IF v_margin_a > 10 AND v_margin_b > 10 THEN
    RETURN 'high';
  END IF;

  RETURN 'medium';
END;
$$;
