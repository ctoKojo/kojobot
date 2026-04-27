-- Sync profiles.level_id whenever student is added/reactivated in a group,
-- so that the student profile always reflects the level of their current active group.

CREATE OR REPLACE FUNCTION public.auto_create_student_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_level_id UUID;
BEGIN
  SELECT level_id INTO v_level_id FROM groups WHERE id = NEW.group_id;

  IF v_level_id IS NOT NULL THEN
    INSERT INTO group_student_progress (group_id, student_id, current_level_id)
    VALUES (NEW.group_id, NEW.student_id, v_level_id)
    ON CONFLICT (group_id, student_id) DO NOTHING;

    -- Keep the student's profile level in sync with the active group level.
    -- Only update when the row is active (covers both INSERT new and UPDATE reactivation).
    IF NEW.is_active = true THEN
      UPDATE profiles
      SET level_id = v_level_id, updated_at = now()
      WHERE user_id = NEW.student_id
        AND (level_id IS DISTINCT FROM v_level_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Also fire on UPDATE so reactivation (is_active false -> true) refreshes the profile level.
DROP TRIGGER IF EXISTS trg_auto_create_student_progress ON public.group_students;
CREATE TRIGGER trg_auto_create_student_progress
AFTER INSERT OR UPDATE OF is_active, group_id ON public.group_students
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_student_progress();

-- Backfill: ensure existing profiles match their current active group level.
UPDATE profiles p
SET level_id = g.level_id, updated_at = now()
FROM group_students gs
JOIN groups g ON g.id = gs.group_id
WHERE gs.student_id = p.user_id
  AND gs.is_active = true
  AND g.level_id IS NOT NULL
  AND p.level_id IS DISTINCT FROM g.level_id;