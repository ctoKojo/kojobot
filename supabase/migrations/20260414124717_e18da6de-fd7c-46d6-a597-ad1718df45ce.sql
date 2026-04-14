CREATE OR REPLACE FUNCTION public.cancel_obsolete_pending_makeups()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'group_student_progress' THEN
    IF NEW.status IN ('awaiting_exam', 'completed') OR NEW.outcome IS NOT NULL THEN
      UPDATE public.makeup_sessions
      SET status = 'cancelled'
      WHERE student_id = NEW.student_id
        AND group_id = NEW.group_id
        AND status = 'pending';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'makeup_sessions' THEN
    IF NEW.status = 'pending' AND EXISTS (
      SELECT 1
      FROM public.group_student_progress gsp
      WHERE gsp.student_id = NEW.student_id
        AND gsp.group_id = NEW.group_id
        AND (gsp.status IN ('awaiting_exam', 'completed') OR gsp.outcome IS NOT NULL)
    ) THEN
      NEW.status := 'cancelled';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;