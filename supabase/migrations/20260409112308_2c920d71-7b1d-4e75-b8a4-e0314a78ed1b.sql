
-- 1. Update the check constraint on groups.status to allow 'completed' and 'archived'
ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_status_check;
ALTER TABLE public.groups ADD CONSTRAINT groups_status_check 
  CHECK (status IN ('active', 'frozen', 'completed', 'archived'));

-- 2. Function: check if a group should be marked as completed
-- Condition: ALL students are is_active=false AND ALL have a final outcome (passed/failed) in level_grades
CREATE OR REPLACE FUNCTION public.check_group_completion(p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_students int;
  v_active_students int;
  v_graded_students int;
  v_group_status text;
  v_group_level_id uuid;
BEGIN
  -- Get current group status and level
  SELECT status, level_id INTO v_group_status, v_group_level_id
  FROM groups WHERE id = p_group_id;
  
  -- Only process active groups
  IF v_group_status != 'active' THEN
    RETURN;
  END IF;

  -- Count total students ever enrolled
  SELECT COUNT(*) INTO v_total_students
  FROM group_students WHERE group_id = p_group_id;

  -- If no students, skip
  IF v_total_students = 0 THEN
    RETURN;
  END IF;

  -- Count still active students
  SELECT COUNT(*) INTO v_active_students
  FROM group_students WHERE group_id = p_group_id AND is_active = true;

  -- If any student is still active, skip
  IF v_active_students > 0 THEN
    RETURN;
  END IF;

  -- Count students with a final outcome (passed or failed) in level_grades for this group+level
  SELECT COUNT(DISTINCT lg.student_id) INTO v_graded_students
  FROM level_grades lg
  JOIN group_students gs ON gs.student_id = lg.student_id AND gs.group_id = lg.group_id
  WHERE lg.group_id = p_group_id
    AND lg.level_id = v_group_level_id
    AND lg.outcome IN ('passed', 'failed');

  -- All students must have a final grade
  IF v_graded_students >= v_total_students THEN
    UPDATE groups 
    SET status = 'completed', 
        is_active = false,
        updated_at = now()
    WHERE id = p_group_id;
    
    -- Log the completion
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      'group_completed',
      'group',
      p_group_id,
      jsonb_build_object(
        'total_students', v_total_students,
        'graded_students', v_graded_students,
        'auto', true
      )
    );
  END IF;
END;
$$;

-- 3. Trigger on level_grades: when a grade is inserted/updated, check if group is now complete
CREATE OR REPLACE FUNCTION public.on_level_grade_check_group_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM check_group_completion(NEW.group_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS z_check_group_completion_on_grade ON public.level_grades;
CREATE TRIGGER z_check_group_completion_on_grade
  AFTER INSERT OR UPDATE ON public.level_grades
  FOR EACH ROW
  EXECUTE FUNCTION public.on_level_grade_check_group_completion();

-- 4. Function to manually archive a group (for admin use)
CREATE OR REPLACE FUNCTION public.archive_group(p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE groups 
  SET status = 'archived',
      is_active = false,
      updated_at = now()
  WHERE id = p_group_id
    AND status IN ('completed', 'active', 'frozen');
END;
$$;

-- 5. Auto-archive cron: groups that have been 'completed' for 7+ days → 'archived'
-- This will be set up via cron job separately
