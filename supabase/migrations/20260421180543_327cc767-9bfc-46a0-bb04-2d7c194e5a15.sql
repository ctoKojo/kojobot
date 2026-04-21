CREATE OR REPLACE FUNCTION public.complete_makeup_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_session RECORD;
  v_makeup RECORD;
  v_caller_id UUID;
  v_attendance_inserted BOOLEAN := false;
BEGIN
  v_caller_id := auth.uid();

  SELECT s.* INTO v_session
  FROM sessions s
  WHERE s.id = p_session_id
  FOR UPDATE;

  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF NOT v_session.is_makeup THEN
    RAISE EXCEPTION 'Session is not a makeup session';
  END IF;

  IF v_session.status = 'completed' THEN
    RETURN jsonb_build_object('completed', false, 'reason', 'already_completed');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = v_session.group_id
    AND (
      g.instructor_id = v_caller_id
      OR has_role(v_caller_id, 'admin'::app_role)
      OR has_role(v_caller_id, 'reception'::app_role)
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT ms.* INTO v_makeup
  FROM makeup_sessions ms
  WHERE ms.id = v_session.makeup_session_id
  FOR UPDATE;

  IF v_makeup IS NULL THEN
    RAISE EXCEPTION 'Linked makeup session not found';
  END IF;

  INSERT INTO attendance (session_id, student_id, status, notes, recorded_by, compensation_status, makeup_session_id)
  SELECT v_session.id, v_makeup.student_id, 'present', 'Auto-recorded when completing makeup session', v_caller_id, 'none', v_makeup.id
  WHERE NOT EXISTS (
    SELECT 1 FROM attendance
    WHERE session_id = v_session.id
      AND student_id = v_makeup.student_id
  );

  GET DIAGNOSTICS v_attendance_inserted = ROW_COUNT;

  UPDATE sessions SET status = 'completed', updated_at = now()
  WHERE id = p_session_id;

  UPDATE makeup_sessions SET status = 'completed', completed_at = COALESCE(completed_at, now())
  WHERE id = v_session.makeup_session_id;

  UPDATE attendance SET compensation_status = 'compensated'
  WHERE session_id = v_makeup.original_session_id
    AND student_id = v_makeup.student_id
    AND compensation_status = 'pending_compensation';

  RETURN jsonb_build_object(
    'completed', true,
    'attendance_inserted', v_attendance_inserted,
    'student_id', v_makeup.student_id,
    'original_session_id', v_makeup.original_session_id
  );
END;
$function$;