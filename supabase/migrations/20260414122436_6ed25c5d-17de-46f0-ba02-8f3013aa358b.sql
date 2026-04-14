
CREATE OR REPLACE FUNCTION public.validate_staff_attendance_timing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_date date;
  v_session_time time;
  v_session_start timestamptz;
BEGIN
  SELECT session_date, session_time
  INTO v_session_date, v_session_time
  FROM public.sessions
  WHERE id = NEW.session_id;

  IF v_session_date IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  v_session_start := (v_session_date || ' ' || v_session_time)::timestamp AT TIME ZONE 'Africa/Cairo';

  IF now() < v_session_start THEN
    RAISE EXCEPTION 'Cannot record staff attendance before session starts. Session starts at % (Cairo time)',
      (v_session_start AT TIME ZONE 'Africa/Cairo')::text;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_staff_attendance_timing
  BEFORE INSERT ON public.session_staff_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_staff_attendance_timing();
