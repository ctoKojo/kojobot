
-- =============================================
-- EVALUATION SYSTEM - FULL MIGRATION (fixed)
-- =============================================

-- 1. TABLES
CREATE TABLE public.evaluation_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  age_group_id uuid NOT NULL REFERENCES public.age_groups(id),
  key text NOT NULL,
  name text NOT NULL,
  name_ar text NOT NULL,
  description text,
  description_ar text,
  rubric_levels jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_score integer NOT NULL,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (age_group_id, key)
);

CREATE TABLE public.session_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id),
  student_id uuid NOT NULL,
  evaluated_by uuid NOT NULL,
  criteria_snapshot jsonb NOT NULL,
  scores jsonb NOT NULL,
  total_behavior_score numeric NOT NULL DEFAULT 0,
  max_behavior_score numeric NOT NULL DEFAULT 0,
  quiz_score numeric,
  quiz_max_score numeric,
  assignment_score numeric,
  assignment_max_score numeric,
  total_score numeric GENERATED ALWAYS AS (
    total_behavior_score + COALESCE(quiz_score, 0) + COALESCE(assignment_score, 0)
  ) STORED,
  max_total_score numeric GENERATED ALWAYS AS (
    max_behavior_score + COALESCE(quiz_max_score, 0) + COALESCE(assignment_max_score, 0)
  ) STORED,
  percentage numeric GENERATED ALWAYS AS (
    CASE WHEN (max_behavior_score + COALESCE(quiz_max_score, 0) + COALESCE(assignment_max_score, 0)) > 0
    THEN ROUND(
      (total_behavior_score + COALESCE(quiz_score, 0) + COALESCE(assignment_score, 0))::numeric
      / (max_behavior_score + COALESCE(quiz_max_score, 0) + COALESCE(assignment_max_score, 0))::numeric
      * 100, 1
    )
    ELSE 0 END
  ) STORED,
  notes text,
  student_feedback_tags text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (session_id, student_id)
);

-- 2. VIEW FOR STUDENTS (no notes)
CREATE VIEW public.student_session_evaluations_view
WITH (security_invoker = true) AS
SELECT
  id, session_id, student_id, evaluated_by,
  scores, total_behavior_score, max_behavior_score,
  quiz_score, quiz_max_score,
  assignment_score, assignment_max_score,
  total_score, max_total_score, percentage,
  student_feedback_tags,
  created_at, updated_at
FROM public.session_evaluations;

-- 3. INDEXES (removed expression index that requires IMMUTABLE)
CREATE INDEX idx_session_evaluations_student_time ON public.session_evaluations (student_id, created_at DESC);
CREATE INDEX idx_session_evaluations_session_pct ON public.session_evaluations (session_id, percentage DESC);
CREATE INDEX idx_evaluation_criteria_age_group ON public.evaluation_criteria (age_group_id, display_order);

-- 4. RLS
ALTER TABLE public.evaluation_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_evaluation_criteria"
ON public.evaluation_criteria FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "read_active_evaluation_criteria"
ON public.evaluation_criteria FOR SELECT TO authenticated
USING (is_active = true);

CREATE POLICY "admin_full_session_evaluations"
ON public.session_evaluations FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "instructor_select_session_evaluations"
ON public.session_evaluations FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'instructor')
  AND session_id IN (
    SELECT s.id FROM public.sessions s
    JOIN public.groups g ON s.group_id = g.id
    WHERE g.instructor_id = auth.uid()
  )
);

CREATE POLICY "instructor_insert_session_evaluations"
ON public.session_evaluations FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'instructor')
  AND evaluated_by = auth.uid()
  AND session_id IN (
    SELECT s.id FROM public.sessions s
    JOIN public.groups g ON s.group_id = g.id
    WHERE g.instructor_id = auth.uid()
  )
);

CREATE POLICY "instructor_update_session_evaluations"
ON public.session_evaluations FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'instructor')
  AND session_id IN (
    SELECT s.id FROM public.sessions s
    JOIN public.groups g ON s.group_id = g.id
    WHERE g.instructor_id = auth.uid()
  )
);

CREATE POLICY "reception_select_session_evaluations"
ON public.session_evaluations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'reception'));

CREATE POLICY "student_select_own_evaluations_via_view"
ON public.session_evaluations FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'student')
  AND student_id = auth.uid()
);

-- 5. TRIGGERS

-- 5.1 Auto-update updated_at
CREATE OR REPLACE FUNCTION public.eval_auto_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_eval_auto_updated_at
BEFORE UPDATE ON public.session_evaluations
FOR EACH ROW EXECUTE FUNCTION public.eval_auto_updated_at();

-- 5.2 24-hour edit lock
CREATE OR REPLACE FUNCTION public.eval_lock_after_24h()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  IF OLD.created_at < now() - interval '24 hours'
    AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Evaluation locked after 24 hours';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_eval_lock_24h
BEFORE UPDATE ON public.session_evaluations
FOR EACH ROW EXECUTE FUNCTION public.eval_lock_after_24h();

-- 5.3 Validate scores + compute max_behavior_score + total_behavior_score
CREATE OR REPLACE FUNCTION public.eval_validate_and_compute()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public AS $$
DECLARE
  v_criterion jsonb;
  v_key text;
  v_allowed_values jsonb;
  v_max_sum numeric := 0;
  v_total numeric := 0;
  v_score_value numeric;
BEGIN
  FOR v_criterion IN SELECT * FROM jsonb_array_elements(NEW.criteria_snapshot)
  LOOP
    v_key := v_criterion->>'key';
    
    IF NOT (NEW.scores ? v_key) THEN
      RAISE EXCEPTION 'Missing required criteria score: %', v_key;
    END IF;
    
    v_score_value := (NEW.scores->>v_key)::numeric;
    v_allowed_values := v_criterion->'rubric_levels';
    
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_allowed_values) AS lv
      WHERE (lv->>'value')::numeric = v_score_value
    ) THEN
      RAISE EXCEPTION 'Invalid score % for criteria %', v_score_value, v_key;
    END IF;
    
    v_max_sum := v_max_sum + (v_criterion->>'max_score')::numeric;
    v_total := v_total + v_score_value;
  END LOOP;
  
  FOR v_key IN SELECT jsonb_object_keys(NEW.scores)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(NEW.criteria_snapshot) AS c
      WHERE c->>'key' = v_key
    ) THEN
      RAISE EXCEPTION 'Unknown criteria key in scores: %', v_key;
    END IF;
  END LOOP;
  
  NEW.max_behavior_score := v_max_sum;
  NEW.total_behavior_score := v_total;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_eval_validate_compute
BEFORE INSERT OR UPDATE ON public.session_evaluations
FOR EACH ROW EXECUTE FUNCTION public.eval_validate_and_compute();

-- 5.4 Require finalized attendance
CREATE OR REPLACE FUNCTION public.eval_require_attendance()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public AS $$
DECLARE
  v_group_id uuid;
  v_student_count integer;
  v_attendance_count integer;
BEGIN
  SELECT s.group_id INTO v_group_id
  FROM public.sessions s WHERE s.id = NEW.session_id;
  
  IF NOT EXISTS (
    SELECT 1 FROM public.attendance
    WHERE session_id = NEW.session_id AND student_id = NEW.student_id
  ) THEN
    RAISE EXCEPTION 'Student has no attendance record for this session';
  END IF;
  
  SELECT COUNT(*) INTO v_student_count
  FROM public.group_students
  WHERE group_id = v_group_id AND is_active = true;
  
  SELECT COUNT(*) INTO v_attendance_count
  FROM public.attendance
  WHERE session_id = NEW.session_id;
  
  IF v_attendance_count < v_student_count THEN
    RAISE EXCEPTION 'Attendance not finalized: % of % students recorded', v_attendance_count, v_student_count;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_eval_require_attendance
BEFORE INSERT ON public.session_evaluations
FOR EACH ROW EXECUTE FUNCTION public.eval_require_attendance();

-- 5.5 Verify evaluator authorization
CREATE OR REPLACE FUNCTION public.eval_check_evaluator()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public AS $$
DECLARE
  v_instructor_id uuid;
BEGIN
  SELECT g.instructor_id INTO v_instructor_id
  FROM public.sessions s
  JOIN public.groups g ON s.group_id = g.id
  WHERE s.id = NEW.session_id;
  
  IF NEW.evaluated_by != v_instructor_id
    AND NOT public.has_role(NEW.evaluated_by, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized evaluator';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_eval_check_evaluator
BEFORE INSERT OR UPDATE ON public.session_evaluations
FOR EACH ROW EXECUTE FUNCTION public.eval_check_evaluator();

-- 5.6 Sync quiz scores
CREATE OR REPLACE FUNCTION public.eval_sync_quiz_score()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_session_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT qa.session_id INTO v_session_id
    FROM public.quiz_assignments qa WHERE qa.id = OLD.quiz_assignment_id;
    
    IF v_session_id IS NOT NULL THEN
      UPDATE public.session_evaluations
      SET quiz_score = NULL, quiz_max_score = NULL
      WHERE session_id = v_session_id AND student_id = OLD.student_id;
    END IF;
    RETURN OLD;
  ELSE
    SELECT qa.session_id INTO v_session_id
    FROM public.quiz_assignments qa WHERE qa.id = NEW.quiz_assignment_id;
    
    IF v_session_id IS NOT NULL AND NEW.score IS NOT NULL THEN
      UPDATE public.session_evaluations
      SET quiz_score = NEW.score, quiz_max_score = NEW.max_score
      WHERE session_id = v_session_id AND student_id = NEW.student_id;
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_sync_quiz_to_eval
AFTER INSERT OR UPDATE OR DELETE ON public.quiz_submissions
FOR EACH ROW EXECUTE FUNCTION public.eval_sync_quiz_score();

-- 5.7 Sync assignment scores
CREATE OR REPLACE FUNCTION public.eval_sync_assignment_score()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_session_id uuid;
  v_max_score numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT a.session_id INTO v_session_id
    FROM public.assignments a WHERE a.id = OLD.assignment_id;
    
    IF v_session_id IS NOT NULL THEN
      UPDATE public.session_evaluations
      SET assignment_score = NULL, assignment_max_score = NULL
      WHERE session_id = v_session_id AND student_id = OLD.student_id;
    END IF;
    RETURN OLD;
  ELSE
    SELECT a.session_id, a.max_score INTO v_session_id, v_max_score
    FROM public.assignments a WHERE a.id = NEW.assignment_id;
    
    IF v_session_id IS NOT NULL AND NEW.score IS NOT NULL THEN
      UPDATE public.session_evaluations
      SET assignment_score = NEW.score, assignment_max_score = v_max_score
      WHERE session_id = v_session_id AND student_id = NEW.student_id;
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_sync_assignment_to_eval
AFTER INSERT OR UPDATE OR DELETE ON public.assignment_submissions
FOR EACH ROW EXECUTE FUNCTION public.eval_sync_assignment_score();

-- 6. SEED DATA

-- 6-9 age group
INSERT INTO public.evaluation_criteria (age_group_id, key, name, name_ar, description, description_ar, rubric_levels, max_score, display_order) VALUES
('d6af6bc5-f73b-42eb-8dec-882f6437aa14', 'simple_understanding', 'Simple Understanding', 'الفهم البسيط', 'Did the child grasp the general idea?', 'هل فهم الطفل الفكرة العامة؟', '[{"value":0,"label":"Weak","label_ar":"ضعيف"},{"value":5,"label":"Good","label_ar":"جيد"},{"value":10,"label":"Excellent","label_ar":"ممتاز"}]', 10, 1),
('d6af6bc5-f73b-42eb-8dec-882f6437aa14', 'guided_application', 'Guided Application', 'التطبيق بمساعدة', 'Could apply with help or needed full assistance?', 'قدر يطبق مع المدرس ولا محتاج مساعدة كاملة؟', '[{"value":0,"label":"Weak","label_ar":"ضعيف"},{"value":8,"label":"Good","label_ar":"جيد"},{"value":15,"label":"Excellent","label_ar":"ممتاز"}]', 15, 2),
('d6af6bc5-f73b-42eb-8dec-882f6437aa14', 'persistence', 'Persistence', 'المحاولة والاستمرار', 'Does the child keep trying or give up easily?', 'بيحاول ولا بيستسلم؟', '[{"value":0,"label":"Weak","label_ar":"ضعيف"},{"value":5,"label":"Good","label_ar":"جيد"},{"value":10,"label":"Excellent","label_ar":"ممتاز"}]', 10, 3),
('d6af6bc5-f73b-42eb-8dec-882f6437aa14', 'focus', 'Focus & Attention', 'التركيز والانتباه', 'Was the child focused and attentive?', 'بيتابع ولا بيتشتت كتير؟', '[{"value":0,"label":"Weak","label_ar":"ضعيف"},{"value":5,"label":"Good","label_ar":"جيد"},{"value":10,"label":"Excellent","label_ar":"ممتاز"}]', 10, 4),
('d6af6bc5-f73b-42eb-8dec-882f6437aa14', 'participation', 'Participation', 'التفاعل والمشاركة', 'Actively participates and answers?', 'بيرفع ايده ويجاوب ويشارك؟', '[{"value":0,"label":"Weak","label_ar":"ضعيف"},{"value":5,"label":"Good","label_ar":"جيد"},{"value":10,"label":"Excellent","label_ar":"ممتاز"}]', 10, 5),
('d6af6bc5-f73b-42eb-8dec-882f6437aa14', 'discipline', 'Discipline', 'الالتزام بالقواعد', 'Follows rules and respects order?', 'يسمع الكلام ويحترم النظام؟', '[{"value":0,"label":"Weak","label_ar":"ضعيف"},{"value":3,"label":"Good","label_ar":"جيد"},{"value":5,"label":"Excellent","label_ar":"ممتاز"}]', 5, 6),
('d6af6bc5-f73b-42eb-8dec-882f6437aa14', 'teamwork', 'Teamwork', 'العمل الجماعي', 'Cooperates with others?', 'يتعاون ولا يرفض المشاركة؟', '[{"value":0,"label":"Weak","label_ar":"ضعيف"},{"value":3,"label":"Good","label_ar":"جيد"},{"value":5,"label":"Excellent","label_ar":"ممتاز"}]', 5, 7),
('d6af6bc5-f73b-42eb-8dec-882f6437aa14', 'bonus', 'Bonus', 'بونص', 'Creativity, exceptional effort, or unique question', 'ابداع او سؤال مميز او التزام استثنائي', '[{"value":0,"label":"None","label_ar":"لا"},{"value":3,"label":"Good","label_ar":"جيد"},{"value":5,"label":"Outstanding","label_ar":"متميز"}]', 5, 8);

-- 10-13 age group
INSERT INTO public.evaluation_criteria (age_group_id, key, name, name_ar, description, description_ar, rubric_levels, max_score, display_order) VALUES
('6b72094b-cacb-4d17-8d6f-8c9d5904e96d', 'theoretical_understanding', 'Theoretical Understanding', 'الفهم النظري', 'Understands concepts, not just memorizing steps', 'فاهم الفكرة مش حافظ خطوات', '[{"value":0,"label":"None","label_ar":"لا شيء"},{"value":3,"label":"Weak","label_ar":"ضعيف"},{"value":6,"label":"Below Avg","label_ar":"أقل من المتوسط"},{"value":9,"label":"Average","label_ar":"متوسط"},{"value":12,"label":"Good","label_ar":"جيد"},{"value":15,"label":"Excellent","label_ar":"ممتاز"}]', 15, 1),
('6b72094b-cacb-4d17-8d6f-8c9d5904e96d', 'practical_application', 'Practical Application', 'التطبيق العملي', 'Can apply independently or needs help?', 'قدر يطبق بنفسه ولا بمساعدة؟', '[{"value":0,"label":"None","label_ar":"لا شيء"},{"value":4,"label":"Weak","label_ar":"ضعيف"},{"value":8,"label":"Below Avg","label_ar":"أقل من المتوسط"},{"value":12,"label":"Average","label_ar":"متوسط"},{"value":16,"label":"Good","label_ar":"جيد"},{"value":20,"label":"Excellent","label_ar":"ممتاز"}]', 20, 2),
('6b72094b-cacb-4d17-8d6f-8c9d5904e96d', 'problem_solving', 'Problem Solving', 'حل المشكلات', 'Can fix errors and modify code?', 'يعرف يصلح خطأ ويعدل كود؟', '[{"value":0,"label":"None","label_ar":"لا شيء"},{"value":3,"label":"Weak","label_ar":"ضعيف"},{"value":6,"label":"Below Avg","label_ar":"أقل من المتوسط"},{"value":9,"label":"Average","label_ar":"متوسط"},{"value":12,"label":"Good","label_ar":"جيد"},{"value":15,"label":"Excellent","label_ar":"ممتاز"}]', 15, 3),
('6b72094b-cacb-4d17-8d6f-8c9d5904e96d', 'logical_thinking', 'Logical Thinking', 'التفكير المنطقي', 'Orders steps correctly?', 'يرتب خطوات صح؟', '[{"value":0,"label":"None","label_ar":"لا شيء"},{"value":2,"label":"Weak","label_ar":"ضعيف"},{"value":4,"label":"Below Avg","label_ar":"أقل من المتوسط"},{"value":6,"label":"Average","label_ar":"متوسط"},{"value":8,"label":"Good","label_ar":"جيد"},{"value":10,"label":"Excellent","label_ar":"ممتاز"}]', 10, 4),
('6b72094b-cacb-4d17-8d6f-8c9d5904e96d', 'participation', 'Participation', 'التفاعل والمشاركة', 'Asks and answers questions?', 'يسأل ويجاوب؟', '[{"value":0,"label":"None","label_ar":"لا شيء"},{"value":2,"label":"Weak","label_ar":"ضعيف"},{"value":4,"label":"Below Avg","label_ar":"أقل من المتوسط"},{"value":6,"label":"Average","label_ar":"متوسط"},{"value":8,"label":"Good","label_ar":"جيد"},{"value":10,"label":"Excellent","label_ar":"ممتاز"}]', 10, 5),
('6b72094b-cacb-4d17-8d6f-8c9d5904e96d', 'focus', 'Focus & Attention', 'التركيز والانتباه', 'Stays focused and follows along?', 'ملتزم ومتابع؟', '[{"value":0,"label":"None","label_ar":"لا شيء"},{"value":2,"label":"Weak","label_ar":"ضعيف"},{"value":4,"label":"Below Avg","label_ar":"أقل من المتوسط"},{"value":6,"label":"Average","label_ar":"متوسط"},{"value":8,"label":"Good","label_ar":"جيد"},{"value":10,"label":"Excellent","label_ar":"ممتاز"}]', 10, 6),
('6b72094b-cacb-4d17-8d6f-8c9d5904e96d', 'teamwork', 'Teamwork', 'العمل الجماعي', 'Cooperates in group projects?', 'يتعاون في مشروع مشترك؟', '[{"value":0,"label":"None","label_ar":"لا شيء"},{"value":2,"label":"Weak","label_ar":"ضعيف"},{"value":4,"label":"Below Avg","label_ar":"أقل من المتوسط"},{"value":6,"label":"Average","label_ar":"متوسط"},{"value":8,"label":"Good","label_ar":"جيد"},{"value":10,"label":"Excellent","label_ar":"ممتاز"}]', 10, 7),
('6b72094b-cacb-4d17-8d6f-8c9d5904e96d', 'discipline', 'Discipline', 'الالتزام والانضباط', 'Follows rules and is punctual?', 'ملتزم بالقواعد والمواعيد؟', '[{"value":0,"label":"Weak","label_ar":"ضعيف"},{"value":3,"label":"Good","label_ar":"جيد"},{"value":5,"label":"Excellent","label_ar":"ممتاز"}]', 5, 8),
('6b72094b-cacb-4d17-8d6f-8c9d5904e96d', 'improvement', 'Improvement', 'مستوى التطور', 'Improved since last session?', 'تحسن عن السيشن اللي قبلها؟', '[{"value":0,"label":"Weak","label_ar":"ضعيف"},{"value":3,"label":"Good","label_ar":"جيد"},{"value":5,"label":"Excellent","label_ar":"ممتاز"}]', 5, 9);

-- 14-18 age group
INSERT INTO public.evaluation_criteria (age_group_id, key, name, name_ar, description, description_ar, rubric_levels, max_score, display_order) VALUES
('378d8f10-2da5-4de3-b60e-1b4a09d421f6', 'deep_understanding', 'Deep Understanding', 'الفهم النظري العميق', 'Understands why, not just how', 'مش حفظ تعريفات لكن فهم ليه بنستخدم ده', '[{"value":0,"label":"None","label_ar":"لا شيء"},{"value":3,"label":"Weak","label_ar":"ضعيف"},{"value":6,"label":"Below Avg","label_ar":"أقل من المتوسط"},{"value":9,"label":"Average","label_ar":"متوسط"},{"value":12,"label":"Good","label_ar":"جيد"},{"value":15,"label":"Excellent","label_ar":"ممتاز"}]', 15, 1),
('378d8f10-2da5-4de3-b60e-1b4a09d421f6', 'independent_application', 'Independent Application', 'التطبيق العملي المستقل', 'Writes code independently without help', 'يكتب كود لوحده بدون مساعدة', '[{"value":0,"label":"None","label_ar":"لا شيء"},{"value":5,"label":"Weak","label_ar":"ضعيف"},{"value":10,"label":"Below Avg","label_ar":"أقل من المتوسط"},{"value":15,"label":"Average","label_ar":"متوسط"},{"value":20,"label":"Good","label_ar":"جيد"},{"value":25,"label":"Excellent","label_ar":"ممتاز"}]', 25, 2),
('378d8f10-2da5-4de3-b60e-1b4a09d421f6', 'problem_solving', 'Problem Solving', 'حل المشكلات', 'Handles bugs and new requirements', 'يتعامل مع bug أو requirement جديد', '[{"value":0,"label":"None","label_ar":"لا شيء"},{"value":4,"label":"Weak","label_ar":"ضعيف"},{"value":8,"label":"Below Avg","label_ar":"أقل من المتوسط"},{"value":12,"label":"Average","label_ar":"متوسط"},{"value":16,"label":"Good","label_ar":"جيد"},{"value":20,"label":"Excellent","label_ar":"ممتاز"}]', 20, 3),
('378d8f10-2da5-4de3-b60e-1b4a09d421f6', 'code_quality', 'Code Quality', 'جودة الكود', 'Clean code, naming, readability', 'تنظيم، تسمية متغيرات، قراءة الكود', '[{"value":0,"label":"None","label_ar":"لا شيء"},{"value":3,"label":"Weak","label_ar":"ضعيف"},{"value":6,"label":"Below Avg","label_ar":"أقل من المتوسط"},{"value":9,"label":"Average","label_ar":"متوسط"},{"value":12,"label":"Good","label_ar":"جيد"},{"value":15,"label":"Excellent","label_ar":"ممتاز"}]', 15, 4),
('378d8f10-2da5-4de3-b60e-1b4a09d421f6', 'analytical_thinking', 'Analytical Thinking', 'التفكير التحليلي', 'Optimizes solutions, not just implements', 'يحسن الحل مش ينفذه بس', '[{"value":0,"label":"None","label_ar":"لا شيء"},{"value":2,"label":"Weak","label_ar":"ضعيف"},{"value":4,"label":"Below Avg","label_ar":"أقل من المتوسط"},{"value":6,"label":"Average","label_ar":"متوسط"},{"value":8,"label":"Good","label_ar":"جيد"},{"value":10,"label":"Excellent","label_ar":"ممتاز"}]', 10, 5),
('378d8f10-2da5-4de3-b60e-1b4a09d421f6', 'technical_participation', 'Technical Participation', 'المشاركة التقنية', 'Asks smart questions, discusses solutions', 'يسأل اسئلة ذكية ويناقش الحلول', '[{"value":0,"label":"None","label_ar":"لا شيء"},{"value":2,"label":"Weak","label_ar":"ضعيف"},{"value":4,"label":"Below Avg","label_ar":"أقل من المتوسط"},{"value":6,"label":"Average","label_ar":"متوسط"},{"value":8,"label":"Good","label_ar":"جيد"},{"value":10,"label":"Excellent","label_ar":"ممتاز"}]', 10, 6),
('378d8f10-2da5-4de3-b60e-1b4a09d421f6', 'punctuality', 'Punctuality', 'الالتزام بالمواعيد', 'On time and committed', 'ملتزم بالمواعيد', '[{"value":0,"label":"None","label_ar":"لا شيء"},{"value":2,"label":"Weak","label_ar":"ضعيف"},{"value":4,"label":"Below Avg","label_ar":"أقل من المتوسط"},{"value":6,"label":"Average","label_ar":"متوسط"},{"value":8,"label":"Good","label_ar":"جيد"},{"value":10,"label":"Excellent","label_ar":"ممتاز"}]', 10, 7),
('378d8f10-2da5-4de3-b60e-1b4a09d421f6', 'teamwork', 'Teamwork', 'العمل الجماعي', 'Cooperates in shared projects', 'يتعاون في المشاريع المشتركة', '[{"value":0,"label":"None","label_ar":"لا شيء"},{"value":2,"label":"Weak","label_ar":"ضعيف"},{"value":4,"label":"Below Avg","label_ar":"أقل من المتوسط"},{"value":6,"label":"Average","label_ar":"متوسط"},{"value":8,"label":"Good","label_ar":"جيد"},{"value":10,"label":"Excellent","label_ar":"ممتاز"}]', 10, 8),
('378d8f10-2da5-4de3-b60e-1b4a09d421f6', 'bonus', 'Bonus', 'بونص', 'Creative or unconventional solution', 'ابداع أو حل غير تقليدي', '[{"value":0,"label":"None","label_ar":"لا"},{"value":3,"label":"Good","label_ar":"جيد"},{"value":5,"label":"Outstanding","label_ar":"متميز"}]', 5, 9);
