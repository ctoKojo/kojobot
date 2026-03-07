
-- ==================== PLACEMENT EXAM SYSTEM ====================

-- 1. Question Bank
CREATE TABLE IF NOT EXISTS placement_question_bank (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  age_group text NOT NULL CHECK (age_group IN ('6_9', '10_13', '14_18')),
  level text NOT NULL CHECK (level IN ('foundation', 'intermediate', 'advanced')),
  skill text NOT NULL,
  difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_type text NOT NULL DEFAULT 'mcq',
  question_text_ar text NOT NULL,
  options jsonb NOT NULL,
  correct_answer text NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
  explanation_ar text,
  is_active boolean NOT NULL DEFAULT true,
  usage_count int NOT NULL DEFAULT 0,
  success_rate numeric NOT NULL DEFAULT 0,
  code_snippet text,
  image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Exam Attempts
CREATE TABLE IF NOT EXISTS placement_exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  age_group text NOT NULL CHECK (age_group IN ('6_9', '10_13', '14_18')),
  attempt_number int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'expired', 'cancelled')),
  started_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  foundation_score int,
  foundation_max int,
  intermediate_score int,
  intermediate_max int,
  advanced_score int,
  advanced_max int,
  total_score int,
  max_score int,
  percentage numeric,
  recommended_level text,
  confidence_level text CHECK (confidence_level IS NULL OR confidence_level IN ('high', 'medium', 'low')),
  needs_manual_review boolean DEFAULT false,
  weak_skills jsonb,
  approved_level_id uuid REFERENCES levels(id),
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'overridden')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, attempt_number)
);

-- 3. Attempt Questions
CREATE TABLE IF NOT EXISTS placement_exam_attempt_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES placement_exam_attempts(id) ON DELETE CASCADE,
  question_id bigint NOT NULL REFERENCES placement_question_bank(id),
  student_answer text,
  is_correct boolean,
  order_index int NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ==================== RLS ====================
ALTER TABLE placement_question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE placement_exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE placement_exam_attempt_questions ENABLE ROW LEVEL SECURITY;

-- Question Bank: admin only
CREATE POLICY "admin_manage_question_bank" ON placement_question_bank
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Attempts: student reads own rows
CREATE POLICY "student_read_own_attempts" ON placement_exam_attempts
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

-- Attempts: admin/reception full access
CREATE POLICY "admin_reception_manage_attempts" ON placement_exam_attempts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reception'));

-- Attempt Questions: admin/reception only
CREATE POLICY "admin_reception_read_attempt_questions" ON placement_exam_attempt_questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM placement_exam_attempts a
      WHERE a.id = attempt_id
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reception'))
    )
  );

-- ==================== STUDENT SAFE VIEW ====================
CREATE OR REPLACE VIEW placement_exam_student_view AS
SELECT id, student_id, age_group, attempt_number, status,
       started_at, submitted_at, review_status, approved_level_id, created_at
FROM placement_exam_attempts;

-- ==================== ATOMIC STATS FUNCTION ====================
CREATE OR REPLACE FUNCTION public.update_question_stats(p_question_id bigint, p_is_correct boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_usage int;
  v_old_rate numeric;
  v_correct_total numeric;
BEGIN
  SELECT usage_count, success_rate INTO v_usage, v_old_rate
  FROM placement_question_bank
  WHERE id = p_question_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  v_correct_total := (v_old_rate * v_usage) + (CASE WHEN p_is_correct THEN 1 ELSE 0 END);
  v_usage := v_usage + 1;

  UPDATE placement_question_bank
  SET usage_count = v_usage,
      success_rate = CASE WHEN v_usage > 0 THEN v_correct_total / v_usage ELSE 0 END,
      updated_at = now()
  WHERE id = p_question_id;
END;
$$;

-- ==================== INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_pqb_age_level_active ON placement_question_bank(age_group, level, is_active);
CREATE INDEX IF NOT EXISTS idx_pea_student_status ON placement_exam_attempts(student_id, status);
CREATE INDEX IF NOT EXISTS idx_peaq_attempt ON placement_exam_attempt_questions(attempt_id);
