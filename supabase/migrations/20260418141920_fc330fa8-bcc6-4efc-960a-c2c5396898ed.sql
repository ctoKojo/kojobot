-- Fix Hassan's exam: move his in-progress data from another student's assignment
-- to the assignment that was actually created for him.
-- 
-- Background: A bug in MyQuizzes.tsx fetched per-student assignments belonging
-- to other students in the same group. Hassan opened and started answering on
-- another student's exam (1e01cd02). His progress must be transferred to his
-- own assignment (9a1d88cd) so his answers don't go to waste.

DO $$
DECLARE
  v_hassan uuid := '938536f7-72e6-4948-a1cd-95e4fa51a9a4';
  v_wrong_assignment uuid := '1e01cd02-e319-4901-ac36-6743e8463cc7';
  v_correct_assignment uuid := '9a1d88cd-6bb5-4602-90b8-e4587ea6b482';
  v_existing_correct_progress uuid;
BEGIN
  -- Safety check: make sure correct assignment is for Hassan
  IF NOT EXISTS (
    SELECT 1 FROM public.quiz_assignments
    WHERE id = v_correct_assignment AND student_id = v_hassan
  ) THEN
    RAISE EXCEPTION 'Correct assignment % is not assigned to Hassan', v_correct_assignment;
  END IF;

  -- Remove any empty/auto-created progress row on the correct assignment
  -- (so we can repoint the active one without violating uniqueness)
  SELECT id INTO v_existing_correct_progress
  FROM public.exam_live_progress
  WHERE student_id = v_hassan AND quiz_assignment_id = v_correct_assignment;

  IF v_existing_correct_progress IS NOT NULL THEN
    DELETE FROM public.exam_live_progress WHERE id = v_existing_correct_progress;
  END IF;

  -- Repoint the live progress (52/57 answered) to the correct assignment
  UPDATE public.exam_live_progress
  SET quiz_assignment_id = v_correct_assignment
  WHERE student_id = v_hassan
    AND quiz_assignment_id = v_wrong_assignment;

  -- Repoint any draft submission (status != submitted/graded) to correct assignment
  UPDATE public.quiz_submissions
  SET quiz_assignment_id = v_correct_assignment
  WHERE student_id = v_hassan
    AND quiz_assignment_id = v_wrong_assignment
    AND status NOT IN ('submitted', 'graded');

  -- Repoint quiz_question_attempts via the (now-repointed) submissions
  -- (attempts are linked by submission_id, so they follow automatically)

  RAISE NOTICE 'Moved Hassan progress from % to %', v_wrong_assignment, v_correct_assignment;
END $$;
