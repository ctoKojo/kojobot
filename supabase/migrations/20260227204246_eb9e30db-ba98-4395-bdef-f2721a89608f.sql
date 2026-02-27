
-- Step 2: Storage bucket + RLS policies + update RPCs

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-slides-pdf', 'session-slides-pdf', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "admin_upload_pdf" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'session-slides-pdf' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin_update_pdf" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'session-slides-pdf' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin_delete_pdf" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'session-slides-pdf' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin_read_pdf" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'session-slides-pdf' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "student_read_pdf" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'session-slides-pdf'
  AND EXISTS (
    SELECT 1
    FROM public.group_students gs
    JOIN public.groups g ON g.id = gs.group_id
    JOIN public.curriculum_sessions cs ON cs.age_group_id = g.age_group_id AND cs.level_id = g.level_id AND cs.is_active = true
    WHERE gs.student_id = auth.uid()
      AND gs.is_active = true
      AND cs.student_pdf_path = storage.objects.name
  )
);

-- Update update_curriculum_session RPC
CREATE OR REPLACE FUNCTION public.update_curriculum_session(p_id uuid, p_expected_updated_at timestamp with time zone, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id UUID;
  v_current_updated_at TIMESTAMPTZ;
BEGIN
  v_caller_id := auth.uid();
  IF NOT has_role(v_caller_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT updated_at INTO v_current_updated_at
  FROM curriculum_sessions WHERE id = p_id FOR UPDATE;

  IF v_current_updated_at IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_current_updated_at != p_expected_updated_at THEN
    RETURN jsonb_build_object('updated', false, 'reason', 'conflict', 'current_updated_at', v_current_updated_at);
  END IF;

  UPDATE curriculum_sessions SET
    title = COALESCE(p_data->>'title', title),
    title_ar = COALESCE(p_data->>'title_ar', title_ar),
    description = p_data->>'description',
    description_ar = p_data->>'description_ar',
    slides_url = p_data->>'slides_url',
    summary_video_url = p_data->>'summary_video_url',
    full_video_url = p_data->>'full_video_url',
    quiz_id = CASE WHEN p_data->>'quiz_id' = '' OR p_data->>'quiz_id' IS NULL THEN NULL ELSE (p_data->>'quiz_id')::uuid END,
    assignment_title = p_data->>'assignment_title',
    assignment_title_ar = p_data->>'assignment_title_ar',
    assignment_description = p_data->>'assignment_description',
    assignment_description_ar = p_data->>'assignment_description_ar',
    assignment_attachment_url = p_data->>'assignment_attachment_url',
    assignment_attachment_type = p_data->>'assignment_attachment_type',
    assignment_max_score = CASE WHEN p_data->>'assignment_max_score' IS NULL THEN assignment_max_score ELSE (p_data->>'assignment_max_score')::integer END,
    student_pdf_path = CASE WHEN p_data ? 'student_pdf_path' THEN p_data->>'student_pdf_path' ELSE student_pdf_path END,
    student_pdf_filename = CASE WHEN p_data ? 'student_pdf_filename' THEN p_data->>'student_pdf_filename' ELSE student_pdf_filename END,
    student_pdf_size = CASE WHEN p_data ? 'student_pdf_size' THEN (p_data->>'student_pdf_size')::integer ELSE student_pdf_size END,
    updated_at = now()
  WHERE id = p_id;

  RETURN jsonb_build_object('updated', true);
END;
$function$;

-- Drop and recreate get_curriculum_with_access with new return columns
DROP FUNCTION IF EXISTS public.get_curriculum_with_access(uuid,uuid,integer,text,text);

CREATE FUNCTION public.get_curriculum_with_access(p_age_group_id uuid, p_level_id uuid, p_session_number integer, p_subscription_type text DEFAULT NULL::text, p_attendance_mode text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, age_group_id uuid, level_id uuid, session_number integer, title text, title_ar text, description text, description_ar text, slides_url text, summary_video_url text, full_video_url text, quiz_id uuid, assignment_title text, assignment_title_ar text, assignment_description text, assignment_description_ar text, assignment_attachment_url text, assignment_attachment_type text, assignment_max_score integer, version integer, is_published boolean, published_at timestamp with time zone, can_view_slides boolean, can_view_summary_video boolean, can_view_full_video boolean, can_view_assignment boolean, can_view_quiz boolean, student_pdf_path text, student_pdf_filename text, student_pdf_size integer, student_pdf_available boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    cs.id, cs.age_group_id, cs.level_id, cs.session_number,
    cs.title, cs.title_ar, cs.description, cs.description_ar,
    CASE WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'instructor'::app_role)
      THEN cs.slides_url ELSE NULL END,
    cs.summary_video_url, cs.full_video_url,
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
    COALESCE(car.can_view_quiz, true),
    CASE WHEN has_role(auth.uid(), 'admin'::app_role) THEN cs.student_pdf_path ELSE NULL END,
    CASE WHEN has_role(auth.uid(), 'admin'::app_role) THEN cs.student_pdf_filename ELSE NULL END,
    CASE WHEN has_role(auth.uid(), 'admin'::app_role) THEN cs.student_pdf_size ELSE NULL END,
    (cs.student_pdf_path IS NOT NULL)
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
$function$;

-- Update clone_curriculum to copy PDF fields
CREATE OR REPLACE FUNCTION public.clone_curriculum(p_source_age_group_id uuid, p_source_level_id uuid, p_source_version integer, p_target_age_group_id uuid, p_target_level_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id UUID;
  v_source_count INTEGER;
  v_target_version INTEGER;
  v_count INTEGER;
BEGIN
  v_caller_id := auth.uid();
  IF NOT has_role(v_caller_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can clone curriculum';
  END IF;

  SELECT COUNT(*) INTO v_source_count
  FROM curriculum_sessions
  WHERE age_group_id = p_source_age_group_id AND level_id = p_source_level_id AND version = p_source_version AND is_active = true;

  IF v_source_count = 0 THEN
    RAISE EXCEPTION 'Source version does not exist';
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_target_version
  FROM curriculum_sessions
  WHERE age_group_id = p_target_age_group_id AND level_id = p_target_level_id AND is_active = true;

  INSERT INTO curriculum_sessions (
    age_group_id, level_id, session_number,
    title, title_ar, description, description_ar,
    slides_url, summary_video_url, full_video_url, quiz_id,
    assignment_title, assignment_title_ar,
    assignment_description, assignment_description_ar,
    assignment_attachment_url, assignment_attachment_type, assignment_max_score,
    student_pdf_path, student_pdf_filename, student_pdf_size,
    version, is_published, is_active
  )
  SELECT
    p_target_age_group_id, p_target_level_id, session_number,
    title, title_ar, description, description_ar,
    slides_url, summary_video_url, full_video_url, quiz_id,
    assignment_title, assignment_title_ar,
    assignment_description, assignment_description_ar,
    assignment_attachment_url, assignment_attachment_type, assignment_max_score,
    student_pdf_path, student_pdf_filename, student_pdf_size,
    v_target_version, false, true
  FROM curriculum_sessions
  WHERE age_group_id = p_source_age_group_id AND level_id = p_source_level_id AND version = p_source_version AND is_active = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('cloned', true, 'target_version', v_target_version, 'sessions_copied', v_count);
END;
$function$;
