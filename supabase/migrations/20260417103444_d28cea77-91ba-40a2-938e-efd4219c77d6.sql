-- ─────────────────────────────────────────────────────────────────
-- AUDIT-GRADE QUIZ SNAPSHOT (Final canonical layer)
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.quiz_submissions
  ADD COLUMN IF NOT EXISTS questions_snapshot_full jsonb;

COMMENT ON COLUMN public.quiz_submissions.questions_snapshot_full IS
  'SERVER-ONLY: Complete frozen exam state including correct_answer, model_answer, rubric. Used for audit, re-grade, and historical integrity. NEVER expose via RLS or views to students.';

ALTER TABLE public.quiz_submissions
  ADD COLUMN IF NOT EXISTS snapshot_version smallint NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.quiz_submissions.snapshot_version IS
  'Version of the snapshot schema. v1 = {id, question_text, options, ...}. Bump when snapshot shape changes.';

ALTER TABLE public.quiz_question_attempts
  ADD COLUMN IF NOT EXISTS is_correct_original boolean;

COMMENT ON COLUMN public.quiz_question_attempts.is_correct_original IS
  'Snapshot of the original auto-grade decision at submission time. Preserved across manual re-grades for audit trail.';

UPDATE public.quiz_question_attempts
SET is_correct_original = is_correct
WHERE is_correct_original IS NULL AND is_correct IS NOT NULL;

-- Backfill snapshots for old submissions, bypassing the eval-sync trigger
-- which would otherwise hit the 24h evaluation lock.
ALTER TABLE public.quiz_submissions DISABLE TRIGGER USER;

DO $$
DECLARE
  rec RECORD;
  safe_snap jsonb;
  full_snap jsonb;
BEGIN
  FOR rec IN
    SELECT s.id, qa.quiz_id
    FROM public.quiz_submissions s
    JOIN public.quiz_assignments qa ON qa.id = s.quiz_assignment_id
    WHERE s.questions_snapshot IS NULL OR s.questions_snapshot_full IS NULL
  LOOP
    SELECT
      jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'question_text', q.question_text,
          'question_text_ar', q.question_text_ar,
          'options', q.options,
          'points', q.points,
          'order_index', q.order_index,
          'image_url', q.image_url,
          'code_snippet', q.code_snippet,
          'question_type', q.question_type
        ) ORDER BY q.order_index
      ),
      jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'question_text', q.question_text,
          'question_text_ar', q.question_text_ar,
          'options', q.options,
          'correct_answer', q.correct_answer,
          'points', q.points,
          'order_index', q.order_index,
          'image_url', q.image_url,
          'code_snippet', q.code_snippet,
          'question_type', q.question_type,
          'model_answer', q.model_answer,
          'rubric', q.rubric
        ) ORDER BY q.order_index
      )
    INTO safe_snap, full_snap
    FROM public.quiz_questions q
    WHERE q.quiz_id = rec.quiz_id;

    UPDATE public.quiz_submissions
    SET
      questions_snapshot = COALESCE(questions_snapshot, safe_snap),
      questions_snapshot_full = COALESCE(questions_snapshot_full, full_snap)
    WHERE id = rec.id;
  END LOOP;
END $$;

ALTER TABLE public.quiz_submissions ENABLE TRIGGER USER;

-- Column-level lockdown: students/parents/instructors cannot read full snapshot
REVOKE SELECT (questions_snapshot_full) ON public.quiz_submissions FROM authenticated, anon;
GRANT SELECT (questions_snapshot_full) ON public.quiz_submissions TO service_role;