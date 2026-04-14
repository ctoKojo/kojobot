CREATE OR REPLACE FUNCTION public.cancel_obsolete_pending_makeups()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'group_student_progress' THEN
    IF NEW.status = 'awaiting_exam' OR NEW.status = 'completed' OR NEW.outcome IS NOT NULL THEN
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
        AND (
          gsp.status = 'awaiting_exam'
          OR gsp.status = 'completed'
          OR gsp.outcome IS NOT NULL
        )
    ) THEN
      NEW.status := 'cancelled';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_obsolete_pending_makeups_on_progress ON public.group_student_progress;
CREATE TRIGGER trg_cancel_obsolete_pending_makeups_on_progress
AFTER INSERT OR UPDATE OF status, outcome ON public.group_student_progress
FOR EACH ROW
EXECUTE FUNCTION public.cancel_obsolete_pending_makeups();

DROP TRIGGER IF EXISTS trg_cancel_obsolete_pending_makeups_on_makeup ON public.makeup_sessions;
CREATE TRIGGER trg_cancel_obsolete_pending_makeups_on_makeup
BEFORE INSERT OR UPDATE OF status ON public.makeup_sessions
FOR EACH ROW
EXECUTE FUNCTION public.cancel_obsolete_pending_makeups();