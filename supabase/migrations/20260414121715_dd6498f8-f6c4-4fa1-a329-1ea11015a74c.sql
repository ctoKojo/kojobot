
CREATE OR REPLACE FUNCTION public.validate_attendance_timing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_date date;
  v_session_time time;
  v_session_start timestamptz;
  v_now_cairo timestamptz;
BEGIN
  -- Get the session date and time
  SELECT session_date, session_time
  INTO v_session_date, v_session_time
  FROM public.sessions
  WHERE id = NEW.session_id;

  IF v_session_date IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  -- Build session start timestamp in Cairo timezone
  v_session_start := (v_session_date || ' ' || v_session_time)::timestamp AT TIME ZONE 'Africa/Cairo';

  -- Current time in Cairo
  v_now_cairo := now();

  -- Block attendance if session hasn't started yet
  IF v_now_cairo < v_session_start THEN
    RAISE EXCEPTION 'Cannot record attendance before session starts. Session starts at % (Cairo time)', 
      (v_session_start AT TIME ZONE 'Africa/Cairo')::text;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_attendance_timing
  BEFORE INSERT ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_attendance_timing();
