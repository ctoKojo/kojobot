
-- =============================================
-- Phase 1: Curriculum System + Makeup Improvements
-- =============================================

-- 1.1 curriculum_sessions table
CREATE TABLE public.curriculum_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  age_group_id UUID NOT NULL REFERENCES public.age_groups(id),
  level_id UUID NOT NULL REFERENCES public.levels(id),
  session_number INTEGER NOT NULL CHECK (session_number >= 1 AND session_number <= 12),
  title TEXT NOT NULL DEFAULT '',
  title_ar TEXT NOT NULL DEFAULT '',
  description TEXT,
  description_ar TEXT,
  slides_url TEXT,
  summary_video_url TEXT,
  full_video_url TEXT,
  quiz_id UUID REFERENCES public.quizzes(id),
  assignment_title TEXT,
  assignment_title_ar TEXT,
  assignment_description TEXT,
  assignment_description_ar TEXT,
  assignment_attachment_url TEXT,
  assignment_attachment_type TEXT,
  assignment_max_score INTEGER DEFAULT 100,
  version INTEGER NOT NULL DEFAULT 1,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(age_group_id, level_id, session_number, version)
);

-- Indexes for curriculum_sessions
CREATE INDEX idx_curriculum_sessions_lookup ON public.curriculum_sessions (age_group_id, level_id, session_number);
CREATE INDEX idx_curriculum_sessions_latest ON public.curriculum_sessions (age_group_id, level_id, is_active, version DESC);

-- Trigger for updated_at
CREATE TRIGGER update_curriculum_sessions_updated_at
  BEFORE UPDATE ON public.curriculum_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.curriculum_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage curriculum sessions"
  ON public.curriculum_sessions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors can view curriculum sessions"
  ON public.curriculum_sessions FOR SELECT
  USING (has_role(auth.uid(), 'instructor'::app_role));

CREATE POLICY "Students can view active published curriculum"
  ON public.curriculum_sessions FOR SELECT
  USING (
    has_role(auth.uid(), 'student'::app_role)
    AND is_active = true
    AND is_published = true
  );

-- 1.2 content_access_rules table
CREATE TABLE public.content_access_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_type TEXT NOT NULL,
  attendance_mode TEXT NOT NULL,
  can_view_slides BOOLEAN DEFAULT true,
  can_view_summary_video BOOLEAN DEFAULT false,
  can_view_full_video BOOLEAN DEFAULT false,
  can_view_assignment BOOLEAN DEFAULT true,
  can_view_quiz BOOLEAN DEFAULT true,
  effective_from DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(subscription_type, attendance_mode)
);

CREATE TRIGGER update_content_access_rules_updated_at
  BEFORE UPDATE ON public.content_access_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.content_access_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage content access rules"
  ON public.content_access_rules FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view content access rules"
  ON public.content_access_rules FOR SELECT
  USING (true);

-- 1.3 student_makeup_credits (Ledger)
CREATE TABLE public.student_makeup_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  level_id UUID NOT NULL REFERENCES public.levels(id),
  total_free_allowed INTEGER NOT NULL DEFAULT 2,
  used_free INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, level_id)
);

CREATE TRIGGER update_student_makeup_credits_updated_at
  BEFORE UPDATE ON public.student_makeup_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.student_makeup_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage makeup credits"
  ON public.student_makeup_credits FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Reception can manage makeup credits"
  ON public.student_makeup_credits FOR ALL
  USING (has_role(auth.uid(), 'reception'::app_role));

CREATE POLICY "Students can view their own credits"
  ON public.student_makeup_credits FOR SELECT
  USING (has_role(auth.uid(), 'student'::app_role) AND student_id = auth.uid());

-- 1.4 RPC: get_curriculum_with_access
CREATE OR REPLACE FUNCTION public.get_curriculum_with_access(
  p_age_group_id UUID,
  p_level_id UUID,
  p_session_number INTEGER,
  p_subscription_type TEXT DEFAULT NULL,
  p_attendance_mode TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  age_group_id UUID,
  level_id UUID,
  session_number INTEGER,
  title TEXT,
  title_ar TEXT,
  description TEXT,
  description_ar TEXT,
  slides_url TEXT,
  summary_video_url TEXT,
  full_video_url TEXT,
  quiz_id UUID,
  assignment_title TEXT,
  assignment_title_ar TEXT,
  assignment_description TEXT,
  assignment_description_ar TEXT,
  assignment_attachment_url TEXT,
  assignment_attachment_type TEXT,
  assignment_max_score INTEGER,
  version INTEGER,
  is_published BOOLEAN,
  published_at TIMESTAMPTZ,
  can_view_slides BOOLEAN,
  can_view_summary_video BOOLEAN,
  can_view_full_video BOOLEAN,
  can_view_assignment BOOLEAN,
  can_view_quiz BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cs.id, cs.age_group_id, cs.level_id, cs.session_number,
    cs.title, cs.title_ar, cs.description, cs.description_ar,
    cs.slides_url, cs.summary_video_url, cs.full_video_url,
    cs.quiz_id,
    cs.assignment_title, cs.assignment_title_ar,
    cs.assignment_description, cs.assignment_description_ar,
    cs.assignment_attachment_url, cs.assignment_attachment_type,
    cs.assignment_max_score,
    cs.version, cs.is_published, cs.published_at,
    COALESCE(car.can_view_slides, true),
    COALESCE(car.can_view_summary_video, true),
    COALESCE(car.can_view_full_video, true),
    COALESCE(car.can_view_assignment, true),
    COALESCE(car.can_view_quiz, true)
  FROM public.curriculum_sessions cs
  LEFT JOIN public.content_access_rules car
    ON car.subscription_type = p_subscription_type
    AND car.attendance_mode = p_attendance_mode
    AND car.is_active = true
  WHERE cs.age_group_id = p_age_group_id
    AND cs.level_id = p_level_id
    AND cs.session_number = p_session_number
    AND cs.is_active = true
  ORDER BY cs.version DESC
  LIMIT 1;
$$;

-- 1.5 Alter makeup_sessions
ALTER TABLE public.makeup_sessions ADD COLUMN makeup_type TEXT NOT NULL DEFAULT 'individual';
ALTER TABLE public.makeup_sessions ADD COLUMN curriculum_session_id UUID REFERENCES public.curriculum_sessions(id);

-- 1.6 Alter attendance
ALTER TABLE public.attendance ADD COLUMN compensation_status TEXT DEFAULT NULL;
ALTER TABLE public.attendance ADD COLUMN makeup_session_id UUID REFERENCES public.makeup_sessions(id);

-- 1.7 Alter quiz_assignments and assignments
ALTER TABLE public.quiz_assignments ADD COLUMN curriculum_snapshot JSONB DEFAULT NULL;
ALTER TABLE public.assignments ADD COLUMN curriculum_snapshot JSONB DEFAULT NULL;

-- 1.8 Storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('curriculum', 'curriculum', false);

-- Storage policies for curriculum bucket
CREATE POLICY "Admins can manage curriculum files"
  ON storage.objects FOR ALL
  USING (bucket_id = 'curriculum' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors can view curriculum files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'curriculum' AND has_role(auth.uid(), 'instructor'::app_role));

CREATE POLICY "Students can view curriculum files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'curriculum' AND has_role(auth.uid(), 'student'::app_role));

-- 1.10 Default content access rules
INSERT INTO public.content_access_rules (subscription_type, attendance_mode, can_view_slides, can_view_summary_video, can_view_full_video)
VALUES
  ('kojo_squad', 'offline', true, false, false),
  ('kojo_squad', 'online', true, false, false),
  ('kojo_core', 'offline', true, true, false),
  ('kojo_core', 'online', true, true, false),
  ('kojo_x', 'offline', true, true, true),
  ('kojo_x', 'online', true, true, true);
