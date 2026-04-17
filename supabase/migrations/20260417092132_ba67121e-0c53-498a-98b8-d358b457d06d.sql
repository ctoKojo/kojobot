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
  v_relinked_makeups INTEGER := 0;
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

  SELECT COALESCE(MAX(version), 1) INTO v_target_version
  FROM curriculum_sessions
  WHERE age_group_id = p_target_age_group_id AND level_id = p_target_level_id AND is_active = true;

  -- Save existing target PDF assets before deleting
  CREATE TEMP TABLE _preserved_assets ON COMMIT DROP AS
  SELECT
    cs.session_number,
    csa.student_pdf_path,
    csa.student_pdf_filename,
    csa.student_pdf_size,
    csa.student_pdf_text,
    csa.student_pdf_text_updated_at,
    csa.processing_status
  FROM curriculum_session_assets csa
  JOIN curriculum_sessions cs ON cs.id = csa.session_id
  WHERE cs.age_group_id = p_target_age_group_id
    AND cs.level_id = p_target_level_id
    AND cs.version = v_target_version
    AND cs.is_active = true
    AND csa.student_pdf_path IS NOT NULL;

  -- Save makeup_sessions links by session_number BEFORE deleting target sessions
  -- (FK is ON DELETE SET NULL, so we capture mapping now to re-link after clone)
  CREATE TEMP TABLE _preserved_makeups ON COMMIT DROP AS
  SELECT
    ms.id AS makeup_id,
    cs.session_number
  FROM makeup_sessions ms
  JOIN curriculum_sessions cs ON cs.id = ms.curriculum_session_id
  WHERE cs.age_group_id = p_target_age_group_id
    AND cs.level_id = p_target_level_id
    AND cs.version = v_target_version
    AND cs.is_active = true;

  -- Delete existing target sessions + assets
  DELETE FROM curriculum_session_assets
  WHERE session_id IN (
    SELECT id FROM curriculum_sessions
    WHERE age_group_id = p_target_age_group_id AND level_id = p_target_level_id AND version = v_target_version AND is_active = true
  );

  DELETE FROM curriculum_sessions
  WHERE age_group_id = p_target_age_group_id AND level_id = p_target_level_id AND version = v_target_version AND is_active = true;

  -- Clone sessions
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

  -- Clone assets: prefer source PDF, fallback to preserved target PDF
  INSERT INTO curriculum_session_assets (
    session_id, student_pdf_path, student_pdf_filename, student_pdf_size,
    student_pdf_text, student_pdf_text_updated_at, processing_status
  )
  SELECT
    new_cs.id,
    COALESCE(src_csa.student_pdf_path, pa.student_pdf_path),
    COALESCE(src_csa.student_pdf_filename, pa.student_pdf_filename),
    COALESCE(src_csa.student_pdf_size, pa.student_pdf_size),
    COALESCE(src_csa.student_pdf_text, pa.student_pdf_text),
    COALESCE(src_csa.student_pdf_text_updated_at, pa.student_pdf_text_updated_at),
    COALESCE(src_csa.processing_status, pa.processing_status, 'idle')
  FROM curriculum_sessions new_cs
  JOIN curriculum_sessions src_cs
    ON src_cs.age_group_id = p_source_age_group_id
    AND src_cs.level_id = p_source_level_id
    AND src_cs.version = p_source_version
    AND src_cs.is_active = true
    AND src_cs.session_number = new_cs.session_number
  LEFT JOIN curriculum_session_assets src_csa ON src_csa.session_id = src_cs.id
  LEFT JOIN _preserved_assets pa ON pa.session_number = new_cs.session_number
  WHERE new_cs.age_group_id = p_target_age_group_id
    AND new_cs.level_id = p_target_level_id
    AND new_cs.version = v_target_version
    AND new_cs.is_active = true
    AND (src_csa.id IS NOT NULL OR pa.student_pdf_path IS NOT NULL);

  -- Also update legacy PDF columns on curriculum_sessions from preserved assets
  UPDATE curriculum_sessions new_cs
  SET
    student_pdf_path = pa.student_pdf_path,
    student_pdf_filename = pa.student_pdf_filename,
    student_pdf_size = pa.student_pdf_size,
    student_pdf_text = pa.student_pdf_text,
    student_pdf_text_updated_at = pa.student_pdf_text_updated_at
  FROM _preserved_assets pa
  WHERE new_cs.age_group_id = p_target_age_group_id
    AND new_cs.level_id = p_target_level_id
    AND new_cs.version = v_target_version
    AND new_cs.is_active = true
    AND new_cs.session_number = pa.session_number
    AND new_cs.student_pdf_path IS NULL;

  -- Re-link makeup_sessions to the new cloned sessions (matched by session_number)
  UPDATE makeup_sessions ms
  SET curriculum_session_id = new_cs.id
  FROM _preserved_makeups pm
  JOIN curriculum_sessions new_cs
    ON new_cs.age_group_id = p_target_age_group_id
    AND new_cs.level_id = p_target_level_id
    AND new_cs.version = v_target_version
    AND new_cs.is_active = true
    AND new_cs.session_number = pm.session_number
  WHERE ms.id = pm.makeup_id;

  GET DIAGNOSTICS v_relinked_makeups = ROW_COUNT;

  RETURN jsonb_build_object(
    'cloned', true,
    'target_version', v_target_version,
    'sessions_copied', v_count,
    'makeups_relinked', v_relinked_makeups
  );
END;
$function$;