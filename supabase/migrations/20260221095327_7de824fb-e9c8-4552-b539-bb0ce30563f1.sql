-- Update get_curriculum_with_access to filter published content for students
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
    AND (
      cs.is_published = true
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'instructor'::app_role)
    )
  ORDER BY cs.version DESC
  LIMIT 1;
$$;