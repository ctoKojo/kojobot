
-- Fix search_path on new validation functions
CREATE OR REPLACE FUNCTION public.validate_academy_closure()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'end_date must be >= start_date';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_session_cancellation_reason()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.cancellation_reason IS NOT NULL AND NEW.cancellation_reason NOT IN (
    'academy_closure', 'instructor_absent', 'student_request', 'technical_issue', 'other'
  ) THEN
    RAISE EXCEPTION 'Invalid cancellation_reason: %', NEW.cancellation_reason;
  END IF;
  RETURN NEW;
END;
$$;
