
CREATE OR REPLACE FUNCTION public.validate_lifecycle_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  valid BOOLEAN := FALSE;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  valid := CASE
    WHEN OLD.status = 'in_progress'               AND NEW.status = 'awaiting_exam'            THEN TRUE
    WHEN OLD.status = 'awaiting_exam'              AND NEW.status = 'exam_scheduled'           THEN TRUE
    WHEN OLD.status = 'exam_scheduled'             AND NEW.status = 'graded'                   THEN TRUE
    WHEN OLD.status = 'graded'                     AND NEW.status = 'pending_group_assignment'  THEN TRUE
    WHEN OLD.status = 'pending_group_assignment'    AND NEW.status = 'in_progress'              THEN TRUE
    WHEN OLD.status = 'exam_scheduled'             AND NEW.status = 'awaiting_exam'            THEN TRUE
    WHEN OLD.status = 'graded'                     AND NEW.status = 'exam_scheduled'           THEN TRUE
    ELSE FALSE
  END;

  IF NOT valid THEN
    RAISE EXCEPTION 'Invalid lifecycle transition: % → %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;
