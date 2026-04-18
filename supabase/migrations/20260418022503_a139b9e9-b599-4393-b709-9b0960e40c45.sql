
-- Step 1: Delete stale compliance/warning notifications
-- These are notifications that were sent for warnings that no longer exist or are no longer active
DELETE FROM public.notifications n
WHERE n.category IN ('compliance', 'warning')
  AND NOT EXISTS (
    SELECT 1 FROM public.instructor_warnings iw
    WHERE iw.instructor_id = n.user_id
      AND iw.is_active = true
      AND iw.created_at >= n.created_at - INTERVAL '5 minutes'
      AND iw.created_at <= n.created_at + INTERVAL '5 minutes'
  );

-- Step 2: Auto-cleanup trigger - when a warning is resolved, delete its related notifications
CREATE OR REPLACE FUNCTION public.cleanup_notifications_on_warning_resolve()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When warning becomes inactive, delete linked notifications (within +/- 5 min of warning creation)
  IF OLD.is_active = true AND NEW.is_active = false THEN
    DELETE FROM public.notifications
    WHERE user_id = NEW.instructor_id
      AND category IN ('compliance', 'warning')
      AND created_at >= NEW.created_at - INTERVAL '5 minutes'
      AND created_at <= NEW.created_at + INTERVAL '5 minutes';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS z_cleanup_notifications_on_warning_resolve ON public.instructor_warnings;
CREATE TRIGGER z_cleanup_notifications_on_warning_resolve
AFTER UPDATE ON public.instructor_warnings
FOR EACH ROW
WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
EXECUTE FUNCTION public.cleanup_notifications_on_warning_resolve();
