
CREATE OR REPLACE FUNCTION validate_session_cancellation_reason()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cancellation_reason IS NOT NULL AND NEW.cancellation_reason NOT IN (
    'academy_closure', 'instructor_absent', 'student_request', 'technical_issue', 'other', 'group_frozen'
  ) THEN
    RAISE EXCEPTION 'Invalid cancellation_reason: %', NEW.cancellation_reason;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
