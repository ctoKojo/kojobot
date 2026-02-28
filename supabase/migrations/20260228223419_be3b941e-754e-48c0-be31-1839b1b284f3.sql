CREATE OR REPLACE FUNCTION public.create_curriculum_quiz(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- Create the quiz with 15 min default
  INSERT INTO quizzes (title, title_ar, age_group_id, level_id, created_by, duration_minutes, passing_score)
  VALUES (v_title, v_title_ar, v_session.age_group_id, v_session.level_id, auth.uid(), 15, 60)
  RETURNING id INTO v_quiz_id;

  -- Link quiz to session
  UPDATE curriculum_sessions
  SET quiz_id = v_quiz_id, updated_at = now()
  WHERE id = p_session_id;

  RETURN jsonb_build_object('quiz_id', v_quiz_id);
END;
$$;