
-- 1. Placement exam settings per age group
CREATE TABLE public.placement_exam_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  age_group text NOT NULL UNIQUE CHECK (age_group IN ('6_9', '10_13', '14_18')),
  total_questions integer NOT NULL DEFAULT 18,
  foundation_questions integer NOT NULL DEFAULT 6,
  intermediate_questions integer NOT NULL DEFAULT 6,
  advanced_questions integer NOT NULL DEFAULT 6,
  duration_minutes integer NOT NULL DEFAULT 0,
  allow_retake boolean NOT NULL DEFAULT true,
  max_attempts integer NOT NULL DEFAULT 3,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Placement rules per age group
CREATE TABLE public.placement_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  age_group text NOT NULL UNIQUE CHECK (age_group IN ('6_9', '10_13', '14_18')),
  foundation_min_for_intermediate numeric NOT NULL DEFAULT 60,
  intermediate_min_for_intermediate numeric NOT NULL DEFAULT 0,
  foundation_min_for_advanced numeric NOT NULL DEFAULT 60,
  intermediate_min_for_advanced numeric NOT NULL DEFAULT 60,
  advanced_min_for_advanced numeric NOT NULL DEFAULT 60,
  confidence_margin numeric NOT NULL DEFAULT 10,
  manual_review_margin numeric NOT NULL DEFAULT 10,
  pass_threshold numeric NOT NULL DEFAULT 60,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Skill blueprint per age_group/level/skill
CREATE TABLE public.placement_skill_blueprint (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  age_group text NOT NULL CHECK (age_group IN ('6_9', '10_13', '14_18')),
  level text NOT NULL CHECK (level IN ('foundation', 'intermediate', 'advanced')),
  skill text NOT NULL,
  question_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (age_group, level, skill)
);

-- Enable RLS
ALTER TABLE public.placement_exam_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_skill_blueprint ENABLE ROW LEVEL SECURITY;

-- RLS: admin full access
CREATE POLICY "admin_all_placement_exam_settings" ON public.placement_exam_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "read_placement_exam_settings" ON public.placement_exam_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_all_placement_rules" ON public.placement_rules
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "read_placement_rules" ON public.placement_rules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_all_placement_skill_blueprint" ON public.placement_skill_blueprint
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "read_placement_skill_blueprint" ON public.placement_skill_blueprint
  FOR SELECT TO authenticated USING (true);

-- Seed defaults
INSERT INTO public.placement_exam_settings (age_group, total_questions, foundation_questions, intermediate_questions, advanced_questions)
VALUES 
  ('6_9', 18, 6, 6, 6),
  ('10_13', 24, 8, 8, 8),
  ('14_18', 30, 10, 10, 10);

INSERT INTO public.placement_rules (age_group)
VALUES ('6_9'), ('10_13'), ('14_18');
