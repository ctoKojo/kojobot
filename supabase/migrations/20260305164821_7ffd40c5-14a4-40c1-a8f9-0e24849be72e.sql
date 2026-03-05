
-- ============================================================
-- PLACEMENT TEST SYSTEM: 4 tables + RLS
-- ============================================================

-- 1. placement_tests (scheduling — student can read own rows)
CREATE TABLE public.placement_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id),
  age_group_id UUID REFERENCES public.age_groups(id),
  attempt_number INTEGER NOT NULL DEFAULT 1,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, attempt_number)
);

ALTER TABLE public.placement_tests ENABLE ROW LEVEL SECURITY;

-- Student reads own rows only
CREATE POLICY "student_read_own_placement_tests"
  ON public.placement_tests FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

-- Admin/Reception full access
CREATE POLICY "admin_reception_all_placement_tests"
  ON public.placement_tests FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'reception'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'reception'::public.app_role)
  );

-- 2. placement_test_results (admin/reception ONLY — student blocked)
CREATE TABLE public.placement_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_test_id UUID NOT NULL REFERENCES public.placement_tests(id) ON DELETE CASCADE UNIQUE,
  score INTEGER,
  max_score INTEGER,
  percentage NUMERIC(5,2),
  suggested_level_id UUID REFERENCES public.levels(id),
  approved_level_id UUID REFERENCES public.levels(id),
  review_status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.profiles(user_id),
  reviewed_at TIMESTAMPTZ,
  submission_answers JSONB,
  client_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.placement_test_results ENABLE ROW LEVEL SECURITY;

-- Admin/Reception only
CREATE POLICY "admin_reception_all_placement_results"
  ON public.placement_test_results FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'reception'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'reception'::public.app_role)
  );

-- 3. placement_question_levels (link question to level — admin only)
CREATE TABLE public.placement_question_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE UNIQUE,
  level_id UUID NOT NULL REFERENCES public.levels(id)
);

ALTER TABLE public.placement_question_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_placement_question_levels"
  ON public.placement_question_levels FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4. placement_quiz_config (quiz per age group — admin only)
CREATE TABLE public.placement_quiz_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  age_group_id UUID NOT NULL REFERENCES public.age_groups(id) UNIQUE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id),
  pass_threshold NUMERIC NOT NULL DEFAULT 60
);

ALTER TABLE public.placement_quiz_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_placement_quiz_config"
  ON public.placement_quiz_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
