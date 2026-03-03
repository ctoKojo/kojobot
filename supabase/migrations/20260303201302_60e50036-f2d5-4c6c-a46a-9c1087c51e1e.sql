-- Fix eval_require_attendance trigger: only check individual student attendance
-- Remove the overly strict "all students must have attendance" check
CREATE OR REPLACE FUNCTION public.eval_require_attendance()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.attendance
    WHERE session_id = NEW.session_id AND student_id = NEW.student_id
  ) THEN
    RAISE EXCEPTION 'Student has no attendance record for this session';
  END IF;
  
  RETURN NEW;
END;
$$;