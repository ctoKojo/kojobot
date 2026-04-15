CREATE OR REPLACE FUNCTION public.grant_xp_on_quiz_grade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_percentage numeric;
  v_xp integer;
  v_level_id uuid;
BEGIN
  IF NEW.status = 'submitted'
     AND NEW.score IS NOT NULL
     AND NEW.max_score IS NOT NULL
     AND NEW.max_score > 0
     AND COALESCE(NEW.grading_status, 'auto_graded') = 'auto_graded' THEN

    SELECT s.level_id INTO v_level_id
    FROM quiz_assignments qa
    JOIN sessions s ON s.id = qa.session_id
    WHERE qa.id = NEW.quiz_assignment_id;

    v_percentage := (NEW.score::numeric / NEW.max_score::numeric) * 100;
    v_xp := 20 + ROUND((v_percentage / 100.0) * 30);

    INSERT INTO public.student_xp_events (student_id, event_type, xp_amount, reference_id, level_id)
    VALUES (NEW.student_id, 'quiz_score', v_xp, NEW.id, v_level_id)
    ON CONFLICT (student_id, event_type, reference_id) DO NOTHING;

    IF FOUND THEN
      PERFORM public.check_quiz_achievements(NEW.student_id, v_percentage);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;