
-- ============================================================
-- PLACEMENT V2: New Placement Exam System
-- Section-based: Level 0 Gate, Level 1 Gate, Track Inclination
-- ============================================================

-- 1. Settings (singleton)
CREATE TABLE public.placement_v2_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  pass_threshold_section_a INTEGER NOT NULL DEFAULT 60,
  pass_threshold_section_b INTEGER NOT NULL DEFAULT 60,
  track_margin INTEGER NOT NULL DEFAULT 15,
  section_a_question_count INTEGER NOT NULL DEFAULT 20,
  section_b_question_count INTEGER NOT NULL DEFAULT 20,
  section_c_question_count INTEGER NOT NULL DEFAULT 10,
  allow_retake BOOLEAN NOT NULL DEFAULT false,
  max_attempts INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.placement_v2_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on placement_v2_settings"
  ON public.placement_v2_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read placement_v2_settings"
  ON public.placement_v2_settings FOR SELECT TO authenticated
  USING (true);

-- Insert default singleton row
INSERT INTO public.placement_v2_settings (id) VALUES ('00000000-0000-0000-0000-000000000099');

-- 2. Question Bank
CREATE TABLE public.placement_v2_questions (
  id BIGSERIAL PRIMARY KEY,
  section TEXT NOT NULL CHECK (section IN ('section_a', 'section_b', 'section_c')),
  skill TEXT NOT NULL,
  track_category TEXT,
  question_text_ar TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
  code_snippet TEXT,
  image_url TEXT,
  explanation_ar TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected', 'needs_revision')),
  usage_count INTEGER NOT NULL DEFAULT 0,
  success_rate NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Constraint: section_c must have track_category, others must not
ALTER TABLE public.placement_v2_questions ADD CONSTRAINT chk_track_category
  CHECK (
    (section = 'section_c' AND track_category IN ('software', 'hardware'))
    OR (section != 'section_c' AND track_category IS NULL)
  );

ALTER TABLE public.placement_v2_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on placement_v2_questions"
  ON public.placement_v2_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_pv2_questions_section ON public.placement_v2_questions (section, is_active, is_archived);
CREATE INDEX idx_pv2_questions_review ON public.placement_v2_questions (review_status) WHERE NOT is_archived;

-- 3. Schedules
CREATE TABLE public.placement_v2_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_by UUID NOT NULL,
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'open', 'completed', 'expired')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.placement_v2_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on placement_v2_schedules"
  ON public.placement_v2_schedules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Reception manage placement_v2_schedules"
  ON public.placement_v2_schedules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'reception'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'reception'::app_role));

CREATE POLICY "Students read own schedules"
  ON public.placement_v2_schedules FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE INDEX idx_pv2_schedules_student ON public.placement_v2_schedules (student_id, status);

-- Validation trigger: opens_at < closes_at AND closes_at > now() on INSERT
CREATE OR REPLACE FUNCTION public.validate_placement_v2_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.opens_at >= NEW.closes_at THEN
    RAISE EXCEPTION 'opens_at must be before closes_at';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.closes_at <= now() THEN
    RAISE EXCEPTION 'closes_at must be in the future';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_pv2_schedule
  BEFORE INSERT OR UPDATE ON public.placement_v2_schedules
  FOR EACH ROW EXECUTE FUNCTION public.validate_placement_v2_schedule();

-- 4. Attempts
CREATE TABLE public.placement_v2_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.placement_v2_schedules(id),
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'reviewed')),
  
  section_a_score INTEGER,
  section_a_max INTEGER,
  section_a_passed BOOLEAN,
  
  section_b_score INTEGER,
  section_b_max INTEGER,
  section_b_passed BOOLEAN,
  
  section_c_software_score INTEGER,
  section_c_software_max INTEGER,
  section_c_hardware_score INTEGER,
  section_c_hardware_max INTEGER,
  
  recommended_level_id UUID REFERENCES public.levels(id),
  recommended_track TEXT CHECK (recommended_track IN ('software', 'hardware', 'balanced')),
  confidence_level TEXT CHECK (confidence_level IN ('high', 'medium', 'low')),
  needs_manual_review BOOLEAN DEFAULT false,
  
  approved_level_id UUID REFERENCES public.levels(id),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  
  started_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.placement_v2_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on placement_v2_attempts"
  ON public.placement_v2_attempts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students read own attempts"
  ON public.placement_v2_attempts FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students insert own attempts"
  ON public.placement_v2_attempts FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students update own in_progress attempts"
  ON public.placement_v2_attempts FOR UPDATE TO authenticated
  USING (student_id = auth.uid() AND status = 'in_progress');

CREATE INDEX idx_pv2_attempts_student ON public.placement_v2_attempts (student_id, status);

-- 5. Attempt Questions
CREATE TABLE public.placement_v2_attempt_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.placement_v2_attempts(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES public.placement_v2_questions(id),
  section TEXT NOT NULL CHECK (section IN ('section_a', 'section_b', 'section_c')),
  section_skill TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  student_answer TEXT,
  is_correct BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.placement_v2_attempt_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on placement_v2_attempt_questions"
  ON public.placement_v2_attempt_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students manage own attempt questions"
  ON public.placement_v2_attempt_questions FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.placement_v2_attempts a
    WHERE a.id = attempt_id AND a.student_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.placement_v2_attempts a
    WHERE a.id = attempt_id AND a.student_id = auth.uid()
  ));

CREATE INDEX idx_pv2_aq_attempt ON public.placement_v2_attempt_questions (attempt_id, section, order_index);

-- 6. Student view (safe read-only projection)
CREATE VIEW public.placement_v2_student_view AS
SELECT id, student_id, status, attempt_number,
       section_a_passed, section_b_passed,
       recommended_track, confidence_level, needs_manual_review,
       recommended_level_id, approved_level_id,
       started_at, submitted_at, created_at
FROM public.placement_v2_attempts;

-- 7. Function to update v2 question stats atomically
CREATE OR REPLACE FUNCTION public.update_v2_question_stats(p_question_id bigint, p_is_correct boolean)
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
  FROM placement_v2_questions
  WHERE id = p_question_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  v_correct_total := (v_old_rate * v_usage) + (CASE WHEN p_is_correct THEN 1 ELSE 0 END);
  v_usage := v_usage + 1;

  UPDATE placement_v2_questions
  SET usage_count = v_usage,
      success_rate = CASE WHEN v_usage > 0 THEN v_correct_total / v_usage ELSE 0 END,
      updated_at = now()
  WHERE id = p_question_id;
END;
$$;
