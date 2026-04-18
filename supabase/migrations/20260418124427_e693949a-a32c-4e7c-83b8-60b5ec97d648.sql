
CREATE OR REPLACE FUNCTION public.generate_makeup_quiz_overrides()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_start TIMESTAMPTZ;
  v_duration_min INTEGER;
  v_session_end TIMESTAMPTZ;
  v_qa RECORD;
  v_a RECORD;
BEGIN
  IF NEW.status NOT IN ('scheduled', 'confirmed') OR NEW.scheduled_date IS NULL OR NEW.scheduled_time IS NULL THEN
    RETURN NEW;
  END IF;

  v_session_start := (NEW.scheduled_date::text || ' ' || NEW.scheduled_time::text)::timestamp AT TIME ZONE 'Africa/Cairo';

  SELECT COALESCE(g.duration_minutes, 60) INTO v_duration_min
  FROM public.groups g
  WHERE g.id = NEW.group_id;
  v_duration_min := COALESCE(v_duration_min, 60);

  v_session_end := v_session_start + (v_duration_min || ' minutes')::interval;

  FOR v_qa IN
    SELECT id FROM public.quiz_assignments
    WHERE session_id = NEW.original_session_id
      AND is_active = true
      AND COALESCE(is_auto_generated, false) = false
  LOOP
    INSERT INTO public.quiz_assignment_overrides (
      quiz_assignment_id, student_id, start_time, due_date, makeup_session_id, source
    ) VALUES (
      v_qa.id, NEW.student_id, v_session_start, v_session_end, NEW.id, 'makeup_auto'
    )
    ON CONFLICT (quiz_assignment_id, student_id)
    DO UPDATE SET
      start_time = EXCLUDED.start_time,
      due_date = EXCLUDED.due_date,
      makeup_session_id = EXCLUDED.makeup_session_id,
      source = 'makeup_auto',
      updated_at = now();
  END LOOP;

  FOR v_a IN
    SELECT id FROM public.assignments
    WHERE session_id = NEW.original_session_id
      AND COALESCE(is_active, true) = true
      AND COALESCE(is_auto_generated, false) = false
  LOOP
    INSERT INTO public.assignment_overrides (
      assignment_id, student_id, due_date, makeup_session_id, source
    ) VALUES (
      v_a.id, NEW.student_id, v_session_end + interval '7 days', NEW.id, 'makeup_auto'
    )
    ON CONFLICT (assignment_id, student_id)
    DO UPDATE SET
      due_date = EXCLUDED.due_date,
      makeup_session_id = EXCLUDED.makeup_session_id,
      source = 'makeup_auto',
      updated_at = now();
  END LOOP;

  RETURN NEW;
END;
$$;
