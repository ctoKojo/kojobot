
CREATE OR REPLACE FUNCTION public.clone_curriculum(
  p_source_age_group_id UUID,
  p_source_level_id UUID,
  p_source_version INTEGER,
  p_target_age_group_id UUID,
  p_target_level_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Find the current (latest) version of target, or use 1 if none exists
  SELECT COALESCE(MAX(version), 1) INTO v_target_version
  FROM curriculum_sessions
  WHERE age_group_id = p_target_age_group_id AND level_id = p_target_level_id AND is_active = true;

  -- Delete existing sessions in target (same version) + their assets
  DELETE FROM curriculum_session_assets
  WHERE session_id IN (
    SELECT id FROM curriculum_sessions
    WHERE age_group_id = p_target_age_group_id AND level_id = p_target_level_id AND version = v_target_version AND is_active = true
  );

  DELETE FROM curriculum_sessions
  WHERE age_group_id = p_target_age_group_id AND level_id = p_target_level_id AND version = v_target_version AND is_active = true;

  -- Clone sessions into the SAME version
  INSERT INTO curriculum_sessions (
    age_group_id, level_id, session_number,
    title, title_ar, description, description_ar,
    slides_url, summary_video_url, full_video_url, quiz_id,
    assignment_title, assignment_title_ar,
    assignment_description, assignment_description_ar,
    assignment_attachment_url, assignment_attachment_type, assignment_max_score,
    version, is_published, is_active
  )
  SELECT
    p_target_age_group_id, p_target_level_id, session_number,
    title, title_ar, description, description_ar,
    slides_url, summary_video_url, full_video_url, quiz_id,
    assignment_title, assignment_title_ar,
    assignment_description, assignment_description_ar,
    assignment_attachment_url, assignment_attachment_type, assignment_max_score,
    v_target_version, false, true
  FROM curriculum_sessions
  WHERE age_group_id = p_source_age_group_id AND level_id = p_source_level_id AND version = p_source_version AND is_active = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Clone asset rows
  INSERT INTO curriculum_session_assets (
    session_id, student_pdf_path, student_pdf_filename, student_pdf_size,
    student_pdf_text, student_pdf_text_updated_at, processing_status
  )
  SELECT
    new_cs.id, src_csa.student_pdf_path, src_csa.student_pdf_filename, src_csa.student_pdf_size,
    src_csa.student_pdf_text, src_csa.student_pdf_text_updated_at, src_csa.processing_status
  FROM curriculum_sessions new_cs
  JOIN curriculum_sessions src_cs
    ON src_cs.age_group_id = p_source_age_group_id
    AND src_cs.level_id = p_source_level_id
    AND src_cs.version = p_source_version
    AND src_cs.is_active = true
    AND src_cs.session_number = new_cs.session_number
  JOIN curriculum_session_assets src_csa ON src_csa.session_id = src_cs.id
  WHERE new_cs.age_group_id = p_target_age_group_id
    AND new_cs.level_id = p_target_level_id
    AND new_cs.version = v_target_version
    AND new_cs.is_active = true;

  RETURN jsonb_build_object('cloned', true, 'target_version', v_target_version, 'sessions_copied', v_count);
END;
$$;
