-- ═══════════════════════════════════════════════════════════════════
-- CANONICAL ASSESSMENT ENGINE — Final architectural lock
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1) DETERMINISTIC QUIZ VERSIONS
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.quiz_versions
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS question_order uuid[],
  ADD COLUMN IF NOT EXISTS scoring_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS time_limit_minutes integer,
  ADD COLUMN IF NOT EXISTS grading_schema_version smallint NOT NULL DEFAULT 1;

-- One canonical version per (quiz_id, content_hash) → enables dedup
CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_versions_quiz_hash
  ON public.quiz_versions(quiz_id, content_hash)
  WHERE content_hash IS NOT NULL;

COMMENT ON COLUMN public.quiz_versions.content_hash IS
  'SHA-256 over (questions_full + scoring_rules + time_limit + grading_schema_version). Identical content → same version, ensuring determinism.';
COMMENT ON COLUMN public.quiz_versions.question_order IS
  'Final ordered list of question IDs as the student saw them. Supports randomization/shuffle.';
COMMENT ON COLUMN public.quiz_versions.scoring_rules IS
  'Frozen scoring config (passing_score, points distribution, partial-credit rules).';

-- Replace freeze_quiz_version with deterministic implementation
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
  v_question_order uuid[];
  v_scoring_rules jsonb;
  v_hash text;
  v_existing_id uuid;
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
    ) ORDER BY q.order_index),
    array_agg(q.id ORDER BY q.order_index)
  INTO v_questions_full, v_questions_safe, v_question_order
  FROM public.quiz_questions q WHERE q.quiz_id = p_quiz_id;

  IF v_questions_full IS NULL THEN
    RAISE EXCEPTION 'Quiz % has no questions to freeze', p_quiz_id;
  END IF;

  v_scoring_rules := jsonb_build_object(
    'passing_score', COALESCE(v_quiz_row.passing_score, 60),
    'duration_minutes', COALESCE(v_quiz_row.duration_minutes, 30)
  );

  -- Deterministic hash: same content → same hash → same version
  v_hash := encode(
    digest(
      v_questions_full::text || '|' || v_scoring_rules::text || '|' ||
      COALESCE(v_quiz_row.duration_minutes::text, '') || '|1',
      'sha256'
    ),
    'hex'
  );

  -- Reuse existing version if content unchanged (deterministic)
  SELECT id INTO v_existing_id
  FROM public.quiz_versions
  WHERE quiz_id = p_quiz_id AND content_hash = v_hash
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
  FROM public.quiz_versions WHERE quiz_id = p_quiz_id;

  INSERT INTO public.quiz_versions (
    quiz_id, version_number, quiz_config, questions_full, questions_safe,
    content_hash, question_order, scoring_rules, time_limit_minutes,
    grading_schema_version, created_by
  ) VALUES (
    p_quiz_id, v_next_version,
    to_jsonb(v_quiz_row) - 'created_at' - 'updated_at',
    v_questions_full, v_questions_safe,
    v_hash, v_question_order, v_scoring_rules,
    v_quiz_row.duration_minutes, 1, auth.uid()
  )
  ON CONFLICT (quiz_id, content_hash) DO UPDATE SET version_number = quiz_versions.version_number
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- 2) EVENT-SOURCED AUDIT LOG
-- ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.assessment_event_type AS ENUM (
    'submitted', 'auto_graded', 'manual_override', 're_graded',
    'appeal_opened', 'appeal_resolved', 'version_frozen'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.manual_override_reason AS ENUM (
    'student_appeal', 'teacher_correction', 'system_error_fix',
    'rubric_adjustment', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.assessment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type public.assessment_event_type NOT NULL,
  entity_type text NOT NULL,                 -- 'quiz_submission' | 'quiz_attempt' | 'quiz_version'
  entity_id uuid NOT NULL,
  submission_id uuid REFERENCES public.quiz_submissions(id) ON DELETE CASCADE,
  quiz_version_id uuid REFERENCES public.quiz_versions(id) ON DELETE SET NULL,
  actor_id uuid,                             -- who triggered the event (null = system)
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.assessment_events IS
  'Append-only event log for the assessment engine. Enables full replay of grading history and audit trail.';

CREATE INDEX IF NOT EXISTS idx_assessment_events_submission ON public.assessment_events(submission_id, created_at);
CREATE INDEX IF NOT EXISTS idx_assessment_events_entity ON public.assessment_events(entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_assessment_events_type ON public.assessment_events(event_type, created_at DESC);

ALTER TABLE public.assessment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read assessment_events"
  ON public.assessment_events FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'reception'));

-- Block all UPDATE/DELETE — append-only
CREATE POLICY "No updates on assessment_events"
  ON public.assessment_events FOR UPDATE USING (false);
CREATE POLICY "No deletes on assessment_events"
  ON public.assessment_events FOR DELETE USING (false);

-- ─────────────────────────────────────────────────────────────────
-- 3) MANUAL OVERRIDE: REASON CLASSIFICATION
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.quiz_question_attempts
  ADD COLUMN IF NOT EXISTS override_reason_code public.manual_override_reason,
  ADD COLUMN IF NOT EXISTS override_reason_note text;

-- Migrate any existing free-text into note (best-effort)
UPDATE public.quiz_question_attempts
SET override_reason_note = override_reason
WHERE override_reason IS NOT NULL AND override_reason_note IS NULL;

ALTER TABLE public.quiz_question_attempts DROP COLUMN IF EXISTS override_reason;

COMMENT ON COLUMN public.quiz_question_attempts.override_reason_code IS
  'Required category for any manual override. Enables analytics on override patterns.';
COMMENT ON COLUMN public.quiz_question_attempts.override_reason_note IS
  'Optional free-text detail supporting the categorized reason.';

-- ─────────────────────────────────────────────────────────────────
-- 4) UPDATED OVERRIDE TRIGGER → emits assessment event
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.b_track_manual_override()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changed boolean := FALSE;
BEGIN
  -- Detect manual override (final differs from auto, AND from old value)
  IF NEW.is_correct_final IS DISTINCT FROM OLD.is_correct_final
     AND NEW.is_correct_final IS DISTINCT FROM NEW.is_correct_auto THEN

    NEW.manual_override_by := COALESCE(NEW.manual_override_by, auth.uid());
    NEW.manual_override_at := COALESCE(NEW.manual_override_at, now());

    IF NEW.override_reason_code IS NULL THEN
      RAISE EXCEPTION 'override_reason_code is required when overriding is_correct_final (got NULL)';
    END IF;

    v_changed := TRUE;
  END IF;

  -- Mirror final → legacy is_correct
  IF NEW.is_correct_final IS DISTINCT FROM OLD.is_correct_final THEN
    NEW.is_correct := NEW.is_correct_final;
  END IF;

  -- Immutable: is_correct_auto cannot be changed after first set
  IF OLD.is_correct_auto IS NOT NULL AND NEW.is_correct_auto IS DISTINCT FROM OLD.is_correct_auto THEN
    RAISE EXCEPTION 'is_correct_auto is immutable (set once at submission time)';
  END IF;

  -- Append assessment event
  IF v_changed THEN
    INSERT INTO public.assessment_events (
      event_type, entity_type, entity_id, submission_id, actor_id, payload
    ) VALUES (
      'manual_override', 'quiz_attempt', NEW.id, NEW.submission_id, auth.uid(),
      jsonb_build_object(
        'question_id', NEW.question_id,
        'student_id', NEW.student_id,
        'previous_is_correct', OLD.is_correct_final,
        'new_is_correct', NEW.is_correct_final,
        'is_correct_auto', NEW.is_correct_auto,
        'reason_code', NEW.override_reason_code,
        'reason_note', NEW.override_reason_note,
        'previous_score', OLD.score,
        'new_score', NEW.score
      )
    );
  END IF;

  RETURN NEW;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- 5) VERSION-BOUND REVIEW PAYLOAD (no drift)
-- ─────────────────────────────────────────────────────────────────
-- Returns the questions the student actually saw — from their bound version,
-- NOT from current quiz_questions. Prevents grading/review/analytics drift.
CREATE OR REPLACE FUNCTION public.get_submission_review_payload(p_submission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_submission record;
  v_questions_safe jsonb;
  v_attempts jsonb;
BEGIN
  SELECT s.*, qv.questions_safe AS version_questions_safe, qv.question_order
  INTO v_submission
  FROM public.quiz_submissions s
  LEFT JOIN public.quiz_versions qv ON qv.id = s.quiz_version_id
  WHERE s.id = p_submission_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission % not found', p_submission_id;
  END IF;

  -- Authorization: student can only see their own; admins/reception always; instructors via group
  IF auth.uid() != v_submission.student_id
     AND NOT has_role(auth.uid(), 'admin')
     AND NOT has_role(auth.uid(), 'reception')
     AND NOT has_role(auth.uid(), 'instructor')
     AND NOT has_role(auth.uid(), 'parent') THEN
    RAISE EXCEPTION 'Not authorized to view this submission';
  END IF;

  -- Prefer version snapshot (deterministic); fall back to submission snapshot
  v_questions_safe := COALESCE(v_submission.version_questions_safe, v_submission.questions_snapshot);

  SELECT jsonb_agg(jsonb_build_object(
    'question_id', a.question_id,
    'answer', a.answer,
    'is_correct', a.is_correct_final,
    'is_correct_auto', a.is_correct_auto,
    'score', a.score,
    'max_score', a.max_score,
    'grading_status', a.grading_status,
    'has_manual_override', a.manual_override_at IS NOT NULL
  ))
  INTO v_attempts
  FROM public.quiz_question_attempts a
  WHERE a.submission_id = p_submission_id;

  RETURN jsonb_build_object(
    'submission_id', v_submission.id,
    'quiz_version_id', v_submission.quiz_version_id,
    'questions', COALESCE(v_questions_safe, '[]'::jsonb),
    'attempts', COALESCE(v_attempts, '[]'::jsonb),
    'score', v_submission.score,
    'max_score', v_submission.max_score,
    'percentage', v_submission.percentage,
    'grading_status', v_submission.grading_status,
    'submitted_at', v_submission.submitted_at
  );
END $$;