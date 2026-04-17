-- ═══════════════════════════════════════════════════════════════════
-- ENTERPRISE ASSESSMENT ARCHITECTURE — Final canonical layer
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1) QUIZ VERSIONS — immutable frozen quiz definitions
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quiz_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  -- Frozen quiz config + grading rules
  quiz_config jsonb NOT NULL,
  -- Frozen questions WITH correct_answer / model_answer / rubric (server-only)
  questions_full jsonb NOT NULL,
  -- Public-safe questions (no answers) — what students saw
  questions_safe jsonb NOT NULL,
  schema_version smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (quiz_id, version_number)
);

COMMENT ON TABLE public.quiz_versions IS
  'Immutable snapshots of a quiz definition (questions + grading rules) at a point in time. Each submission references one version.';
COMMENT ON COLUMN public.quiz_versions.questions_full IS
  'SERVER-ONLY: includes correct_answer, model_answer, rubric. Locked via column REVOKE.';

ALTER TABLE public.quiz_versions ENABLE ROW LEVEL SECURITY;

-- Only admin/reception can read versions; service_role writes
CREATE POLICY "Admins can read quiz_versions"
  ON public.quiz_versions FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'reception'));

-- Column-level lockdown: nobody outside service_role sees questions_full
REVOKE SELECT (questions_full) ON public.quiz_versions FROM authenticated, anon;
GRANT SELECT (questions_full) ON public.quiz_versions TO service_role;

CREATE INDEX IF NOT EXISTS idx_quiz_versions_quiz ON public.quiz_versions(quiz_id, version_number DESC);

-- ─────────────────────────────────────────────────────────────────
-- 2) Helper RPC: freeze a new version of a quiz
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.freeze_quiz_version(p_quiz_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quiz_row record;
  v_questions_full jsonb;
  v_questions_safe jsonb;
  v_next_version integer;
  v_new_id uuid;
BEGIN
  SELECT * INTO v_quiz_row FROM public.quizzes WHERE id = p_quiz_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiz % not found', p_quiz_id;
  END IF;

  SELECT
    jsonb_agg(jsonb_build_object(
      'id', q.id, 'question_text', q.question_text, 'question_text_ar', q.question_text_ar,
      'options', q.options, 'correct_answer', q.correct_answer, 'points', q.points,
      'order_index', q.order_index, 'image_url', q.image_url, 'code_snippet', q.code_snippet,
      'question_type', q.question_type, 'model_answer', q.model_answer, 'rubric', q.rubric
    ) ORDER BY q.order_index),
    jsonb_agg(jsonb_build_object(
      'id', q.id, 'question_text', q.question_text, 'question_text_ar', q.question_text_ar,
      'options', q.options, 'points', q.points, 'order_index', q.order_index,
      'image_url', q.image_url, 'code_snippet', q.code_snippet, 'question_type', q.question_type
    ) ORDER BY q.order_index)
  INTO v_questions_full, v_questions_safe
  FROM public.quiz_questions q WHERE q.quiz_id = p_quiz_id;

  IF v_questions_full IS NULL THEN
    RAISE EXCEPTION 'Quiz % has no questions to freeze', p_quiz_id;
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
  FROM public.quiz_versions WHERE quiz_id = p_quiz_id;

  INSERT INTO public.quiz_versions (quiz_id, version_number, quiz_config, questions_full, questions_safe, created_by)
  VALUES (
    p_quiz_id, v_next_version,
    to_jsonb(v_quiz_row) - 'created_at' - 'updated_at',
    v_questions_full, v_questions_safe, auth.uid()
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- 3) AUDIT TABLE — isolated sensitive layer per submission
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quiz_submission_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL UNIQUE REFERENCES public.quiz_submissions(id) ON DELETE CASCADE,
  quiz_version_id uuid REFERENCES public.quiz_versions(id) ON DELETE SET NULL,
  -- Frozen at submit time (with correct answers + rubric)
  questions_full_snapshot jsonb NOT NULL,
  -- Per-question grading audit trail
  grading_audit jsonb NOT NULL DEFAULT '[]'::jsonb,
  schema_version smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.quiz_submission_audit IS
  'Isolated sensitive audit layer. Contains correct answers and grading trail per submission. Admin/service-role read only.';

ALTER TABLE public.quiz_submission_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read submission audit"
  ON public.quiz_submission_audit FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'reception'));

CREATE INDEX IF NOT EXISTS idx_quiz_submission_audit_submission ON public.quiz_submission_audit(submission_id);
CREATE INDEX IF NOT EXISTS idx_quiz_submission_audit_version ON public.quiz_submission_audit(quiz_version_id);

-- ─────────────────────────────────────────────────────────────────
-- 4) MIGRATE existing data: questions_snapshot_full → audit table
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.quiz_submission_audit (submission_id, questions_full_snapshot, schema_version)
SELECT id, questions_snapshot_full, COALESCE(snapshot_version, 1)
FROM public.quiz_submissions
WHERE questions_snapshot_full IS NOT NULL
ON CONFLICT (submission_id) DO NOTHING;

-- Now drop the leaky column from the public table
ALTER TABLE public.quiz_submissions DROP COLUMN IF EXISTS questions_snapshot_full;
ALTER TABLE public.quiz_submissions DROP COLUMN IF EXISTS snapshot_version;

-- Add quiz_version_id link
ALTER TABLE public.quiz_submissions
  ADD COLUMN IF NOT EXISTS quiz_version_id uuid REFERENCES public.quiz_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_submissions_version ON public.quiz_submissions(quiz_version_id);

-- ─────────────────────────────────────────────────────────────────
-- 5) MANUAL GRADING LIFECYCLE on quiz_question_attempts
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.quiz_question_attempts
  ADD COLUMN IF NOT EXISTS is_correct_auto boolean,
  ADD COLUMN IF NOT EXISTS is_correct_final boolean,
  ADD COLUMN IF NOT EXISTS manual_override_by uuid,
  ADD COLUMN IF NOT EXISTS manual_override_at timestamptz,
  ADD COLUMN IF NOT EXISTS override_reason text;

-- Backfill from previous columns
UPDATE public.quiz_question_attempts
SET is_correct_auto = COALESCE(is_correct_original, is_correct),
    is_correct_final = is_correct
WHERE is_correct_auto IS NULL;

-- Drop the obsolete original column (replaced by is_correct_auto)
ALTER TABLE public.quiz_question_attempts DROP COLUMN IF EXISTS is_correct_original;

COMMENT ON COLUMN public.quiz_question_attempts.is_correct IS
  'DEPRECATED — use is_correct_final. Kept for backward compatibility.';
COMMENT ON COLUMN public.quiz_question_attempts.is_correct_auto IS
  'Immutable: server auto-grade decision at submit time. Never updated after first write.';
COMMENT ON COLUMN public.quiz_question_attempts.is_correct_final IS
  'Current correctness — equals is_correct_auto unless a teacher manually overrode.';

-- Trigger: detect manual overrides and stamp the audit fields
CREATE OR REPLACE FUNCTION public.b_track_manual_override()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If grader changes is_correct_final to differ from is_correct_auto, stamp it
  IF NEW.is_correct_final IS DISTINCT FROM OLD.is_correct_final
     AND NEW.is_correct_final IS DISTINCT FROM NEW.is_correct_auto THEN
    NEW.manual_override_by := COALESCE(NEW.manual_override_by, auth.uid());
    NEW.manual_override_at := COALESCE(NEW.manual_override_at, now());
  END IF;

  -- Mirror is_correct_final → is_correct for back-compat
  IF NEW.is_correct_final IS DISTINCT FROM OLD.is_correct_final THEN
    NEW.is_correct := NEW.is_correct_final;
  END IF;

  -- Protect immutability of is_correct_auto
  IF OLD.is_correct_auto IS NOT NULL AND NEW.is_correct_auto IS DISTINCT FROM OLD.is_correct_auto THEN
    RAISE EXCEPTION 'is_correct_auto is immutable (set once at submission)';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS b_track_manual_override ON public.quiz_question_attempts;
CREATE TRIGGER b_track_manual_override
  BEFORE UPDATE ON public.quiz_question_attempts
  FOR EACH ROW EXECUTE FUNCTION public.b_track_manual_override();

-- ─────────────────────────────────────────────────────────────────
-- 6) Idempotent backfill helper (no trigger bypass, batch-safe)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.backfill_quiz_audit_batch(p_limit int DEFAULT 50)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_processed int := 0;
  rec record;
  v_full jsonb;
BEGIN
  FOR rec IN
    SELECT s.id AS submission_id, qa.quiz_id
    FROM public.quiz_submissions s
    JOIN public.quiz_assignments qa ON qa.id = s.quiz_assignment_id
    LEFT JOIN public.quiz_submission_audit a ON a.submission_id = s.id
    WHERE a.id IS NULL
    ORDER BY s.submitted_at DESC NULLS LAST
    LIMIT p_limit
  LOOP
    SELECT jsonb_agg(jsonb_build_object(
      'id', q.id, 'question_text', q.question_text, 'question_text_ar', q.question_text_ar,
      'options', q.options, 'correct_answer', q.correct_answer, 'points', q.points,
      'order_index', q.order_index, 'image_url', q.image_url, 'code_snippet', q.code_snippet,
      'question_type', q.question_type, 'model_answer', q.model_answer, 'rubric', q.rubric
    ) ORDER BY q.order_index)
    INTO v_full
    FROM public.quiz_questions q WHERE q.quiz_id = rec.quiz_id;

    IF v_full IS NOT NULL THEN
      INSERT INTO public.quiz_submission_audit (submission_id, questions_full_snapshot)
      VALUES (rec.submission_id, v_full)
      ON CONFLICT (submission_id) DO NOTHING;
      v_processed := v_processed + 1;
    END IF;
  END LOOP;

  RETURN v_processed;
END $$;

COMMENT ON FUNCTION public.backfill_quiz_audit_batch IS
  'Idempotent batch backfill of quiz_submission_audit from current quiz_questions. Safe to run repeatedly. Call until it returns 0.';