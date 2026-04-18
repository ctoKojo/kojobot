-- Hassan's browser kept saving to the wrong assignment after the first
-- migration. Move the freshly-created progress over again, then prevent
-- future writes by deleting the wrong-assignment progress and forcing
-- the live monitor / save endpoints to reject it.

DO $$
DECLARE
  v_hassan uuid := '938536f7-72e6-4948-a1cd-95e4fa51a9a4';
  v_wrong_assignment uuid := '1e01cd02-e319-4901-ac36-6743e8463cc7';
  v_correct_assignment uuid := '9a1d88cd-6bb5-4602-90b8-e4587ea6b482';
  v_wrong_progress_id uuid;
  v_correct_progress_id uuid;
  v_wrong_answers jsonb;
  v_wrong_count int;
  v_wrong_idx int;
  v_wrong_started timestamptz;
BEGIN
  -- Capture latest state from the WRONG-assignment progress (most up-to-date)
  SELECT id, draft_answers, answered_count, current_question_index, started_at
    INTO v_wrong_progress_id, v_wrong_answers, v_wrong_count, v_wrong_idx, v_wrong_started
  FROM public.exam_live_progress
  WHERE student_id = v_hassan AND quiz_assignment_id = v_wrong_assignment;

  IF v_wrong_progress_id IS NOT NULL THEN
    -- Find the correct progress row
    SELECT id INTO v_correct_progress_id
    FROM public.exam_live_progress
    WHERE student_id = v_hassan AND quiz_assignment_id = v_correct_assignment;

    IF v_correct_progress_id IS NOT NULL THEN
      -- Merge latest answers into the correct row
      UPDATE public.exam_live_progress
      SET draft_answers = v_wrong_answers,
          answered_count = GREATEST(answered_count, v_wrong_count),
          current_question_index = v_wrong_idx,
          last_activity_at = now(),
          draft_updated_at = now(),
          draft_version = draft_version + 1
      WHERE id = v_correct_progress_id;
    END IF;

    -- Remove the wrong progress row
    DELETE FROM public.exam_live_progress WHERE id = v_wrong_progress_id;
  END IF;
END $$;
