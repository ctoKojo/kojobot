DROP TRIGGER IF EXISTS trg_cancel_obsolete_pending_makeups_on_makeup ON public.makeup_sessions;
CREATE TRIGGER trg_cancel_obsolete_pending_makeups_on_makeup
BEFORE INSERT OR UPDATE OF status, student_id, group_id ON public.makeup_sessions
FOR EACH ROW
EXECUTE FUNCTION public.cancel_obsolete_pending_makeups();