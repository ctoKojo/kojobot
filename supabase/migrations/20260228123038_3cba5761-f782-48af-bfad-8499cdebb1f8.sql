CREATE OR REPLACE FUNCTION public.update_curriculum_session(p_id uuid, p_expected_updated_at timestamp with time zone, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id UUID;
  v_current_updated_at TIMESTAMPTZ;
  v_new_updated_at TIMESTAMPTZ;
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
  WHERE id = p_id
  RETURNING updated_at INTO v_new_updated_at;

  RETURN jsonb_build_object('updated', true, 'new_updated_at', v_new_updated_at);
END;
$function$;