
-- RPC: create_curriculum_quiz
-- Creates a quiz atomically linked to a curriculum session
CREATE OR REPLACE FUNCTION public.create_curriculum_quiz(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_session record;
  v_quiz_id uuid;
  v_title text;
  v_title_ar text;
BEGIN
  -- Admin check
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  -- Lock the session row
  SELECT id, session_number, age_group_id, level_id, quiz_id
  INTO v_session
  FROM curriculum_sessions
  WHERE id = p_session_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_session.quiz_id IS NOT NULL THEN
    RAISE EXCEPTION 'Session already has a quiz attached';
  END IF;

  -- Build default titles
  v_title := 'Quiz - Session ' || v_session.session_number;
  v_title_ar := 'كويز - سيشن ' || v_session.session_number;

  -- Create the quiz
  INSERT INTO quizzes (title, title_ar, age_group_id, level_id, created_by, duration_minutes, passing_score)
  VALUES (v_title, v_title_ar, v_session.age_group_id, v_session.level_id, auth.uid(), 30, 60)
  RETURNING id INTO v_quiz_id;

  -- Link quiz to session
  UPDATE curriculum_sessions
  SET quiz_id = v_quiz_id, updated_at = now()
  WHERE id = p_session_id;

  RETURN jsonb_build_object('quiz_id', v_quiz_id);
END;
$$;

-- Grant execute to authenticated only
REVOKE ALL ON FUNCTION public.create_curriculum_quiz(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_curriculum_quiz(uuid) TO authenticated;


-- RPC: unassign_curriculum_quiz
-- Safely unlinks a quiz from a session with optimistic concurrency check
CREATE OR REPLACE FUNCTION public.unassign_curriculum_quiz(p_session_id uuid, p_expected_quiz_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_current_quiz_id uuid;
BEGIN
  -- Admin check
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  -- Lock the session row
  SELECT quiz_id INTO v_current_quiz_id
  FROM curriculum_sessions
  WHERE id = p_session_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  -- Optimistic check
  IF v_current_quiz_id IS DISTINCT FROM p_expected_quiz_id THEN
    RETURN jsonb_build_object('unassigned', false, 'reason', 'conflict');
  END IF;

  -- Unassign (quiz record stays in quizzes table)
  UPDATE curriculum_sessions
  SET quiz_id = NULL, updated_at = now()
  WHERE id = p_session_id;

  RETURN jsonb_build_object('unassigned', true);
END;
$$;

-- Grant execute to authenticated only
REVOKE ALL ON FUNCTION public.unassign_curriculum_quiz(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unassign_curriculum_quiz(uuid, uuid) TO authenticated;
