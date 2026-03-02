CREATE OR REPLACE FUNCTION public.update_curriculum_session(
  p_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_data JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    description = CASE WHEN p_data ? 'description' THEN p_data->>'description' ELSE description END,
    description_ar = CASE WHEN p_data ? 'description_ar' THEN p_data->>'description_ar' ELSE description_ar END,
    slides_url = CASE WHEN p_data ? 'slides_url' THEN p_data->>'slides_url' ELSE slides_url END,
    summary_video_url = CASE WHEN p_data ? 'summary_video_url' THEN p_data->>'summary_video_url' ELSE summary_video_url END,
    full_video_url = CASE WHEN p_data ? 'full_video_url' THEN p_data->>'full_video_url' ELSE full_video_url END,
    quiz_id = CASE 
      WHEN NOT (p_data ? 'quiz_id') THEN quiz_id
      WHEN p_data->>'quiz_id' = '' OR p_data->>'quiz_id' IS NULL THEN NULL 
      ELSE (p_data->>'quiz_id')::uuid 
    END,
    assignment_title = CASE WHEN p_data ? 'assignment_title' THEN p_data->>'assignment_title' ELSE assignment_title END,
    assignment_title_ar = CASE WHEN p_data ? 'assignment_title_ar' THEN p_data->>'assignment_title_ar' ELSE assignment_title_ar END,
    assignment_description = CASE WHEN p_data ? 'assignment_description' THEN p_data->>'assignment_description' ELSE assignment_description END,
    assignment_description_ar = CASE WHEN p_data ? 'assignment_description_ar' THEN p_data->>'assignment_description_ar' ELSE assignment_description_ar END,
    assignment_attachment_url = CASE WHEN p_data ? 'assignment_attachment_url' THEN p_data->>'assignment_attachment_url' ELSE assignment_attachment_url END,
    assignment_attachment_type = CASE WHEN p_data ? 'assignment_attachment_type' THEN p_data->>'assignment_attachment_type' ELSE assignment_attachment_type END,
    assignment_max_score = CASE 
      WHEN NOT (p_data ? 'assignment_max_score') THEN assignment_max_score
      WHEN p_data->>'assignment_max_score' IS NULL THEN assignment_max_score 
      ELSE (p_data->>'assignment_max_score')::integer 
    END,
    updated_at = now()
  WHERE id = p_id
  RETURNING updated_at INTO v_new_updated_at;

  RETURN jsonb_build_object('updated', true, 'new_updated_at', v_new_updated_at);
END;
$$;