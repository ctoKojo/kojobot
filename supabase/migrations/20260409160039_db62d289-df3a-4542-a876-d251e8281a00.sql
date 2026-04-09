
-- 1. Add level_id column
ALTER TABLE public.student_xp_events
  ADD COLUMN level_id uuid REFERENCES public.levels(id);

-- 2. Add unique constraint to prevent double-counting
ALTER TABLE public.student_xp_events
  ADD CONSTRAINT unique_xp_event UNIQUE (student_id, event_type, reference_id);

-- 3. Add index for level-scoped queries
CREATE INDEX idx_xp_events_student_level ON public.student_xp_events(student_id, level_id);

-- 4. Backfill existing attendance XP events with level_id from sessions
UPDATE public.student_xp_events xe
SET level_id = s.level_id
FROM public.sessions s
WHERE xe.event_type = 'attendance'
  AND xe.reference_id = s.id
  AND xe.level_id IS NULL;

-- 5. Backfill existing assignment XP events
UPDATE public.student_xp_events xe
SET level_id = s.level_id
FROM public.assignment_submissions asub
JOIN public.assignments a ON a.id = asub.assignment_id
JOIN public.sessions s ON s.id = a.session_id
WHERE xe.event_type = 'assignment_score'
  AND xe.reference_id = asub.id
  AND xe.level_id IS NULL;

-- 6. Backfill existing quiz XP events
UPDATE public.student_xp_events xe
SET level_id = s.level_id
FROM public.quiz_submissions qs
JOIN public.quiz_assignments qa ON qa.id = qs.quiz_assignment_id
JOIN public.sessions s ON s.id = qa.session_id
WHERE xe.event_type = 'quiz_score'
  AND xe.reference_id = qs.id
  AND xe.level_id IS NULL;

-- 7. Recreate attendance trigger with level_id
CREATE OR REPLACE FUNCTION public.grant_xp_on_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level_id uuid;
BEGIN
  IF NEW.status IN ('present', 'late') THEN
    -- Get level_id from session
    SELECT s.level_id INTO v_level_id FROM sessions s WHERE s.id = NEW.session_id;

    INSERT INTO student_xp_events (student_id, event_type, xp_amount, reference_id, level_id)
    VALUES (NEW.student_id, 'attendance', 50, NEW.session_id, v_level_id)
    ON CONFLICT (student_id, event_type, reference_id) DO NOTHING;

    -- Update streak (only if XP was actually inserted)
    IF FOUND THEN
      INSERT INTO student_streaks (student_id, current_streak, longest_streak, last_activity_date)
      VALUES (NEW.student_id, 1, 1, CURRENT_DATE)
      ON CONFLICT (student_id) DO UPDATE SET
        current_streak = CASE
          WHEN student_streaks.last_activity_date = CURRENT_DATE - 1 THEN student_streaks.current_streak + 1
          WHEN student_streaks.last_activity_date = CURRENT_DATE THEN student_streaks.current_streak
          ELSE 1
        END,
        longest_streak = GREATEST(
          student_streaks.longest_streak,
          CASE
            WHEN student_streaks.last_activity_date = CURRENT_DATE - 1 THEN student_streaks.current_streak + 1
            WHEN student_streaks.last_activity_date = CURRENT_DATE THEN student_streaks.current_streak
            ELSE 1
          END
        ),
        last_activity_date = CURRENT_DATE,
        updated_at = now();

      PERFORM check_attendance_achievements(NEW.student_id);
      PERFORM check_streak_achievements(NEW.student_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 8. Recreate quiz trigger with level_id
CREATE OR REPLACE FUNCTION public.grant_xp_on_quiz_grade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_score integer;
  v_percentage numeric;
  v_xp integer;
  v_level_id uuid;
BEGIN
  IF NEW.status = 'graded' AND NEW.total_score IS NOT NULL THEN
    -- Get level_id via quiz_assignments -> sessions
    SELECT s.level_id INTO v_level_id
    FROM quiz_assignments qa
    JOIN sessions s ON s.id = qa.session_id
    WHERE qa.id = NEW.quiz_assignment_id;

    v_max_score := COALESCE(NEW.max_total_score, 100);
    v_percentage := CASE WHEN v_max_score > 0 THEN (NEW.total_score::numeric / v_max_score) * 100 ELSE 0 END;
    v_xp := 20 + ROUND((v_percentage / 100.0) * 30);

    INSERT INTO student_xp_events (student_id, event_type, xp_amount, reference_id, level_id)
    VALUES (NEW.student_id, 'quiz_score', v_xp, NEW.id, v_level_id)
    ON CONFLICT (student_id, event_type, reference_id) DO NOTHING;

    IF FOUND THEN
      PERFORM check_quiz_achievements(NEW.student_id, v_percentage);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 9. Recreate assignment trigger with level_id
CREATE OR REPLACE FUNCTION public.grant_xp_on_assignment_grade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_score integer;
  v_percentage numeric;
  v_xp integer;
  v_level_id uuid;
BEGIN
  IF NEW.status = 'graded' AND NEW.score IS NOT NULL THEN
    -- Get level_id via assignments -> sessions
    SELECT s.level_id INTO v_level_id
    FROM assignments a
    JOIN sessions s ON s.id = a.session_id
    WHERE a.id = NEW.assignment_id;

    SELECT COALESCE(a.max_score, 100) INTO v_max_score
    FROM assignments a WHERE a.id = NEW.assignment_id;

    v_percentage := CASE WHEN v_max_score > 0 THEN (NEW.score::numeric / v_max_score) * 100 ELSE 0 END;
    v_xp := 20 + ROUND((v_percentage / 100.0) * 30);

    INSERT INTO student_xp_events (student_id, event_type, xp_amount, reference_id, level_id)
    VALUES (NEW.student_id, 'assignment_score', v_xp, NEW.id, v_level_id)
    ON CONFLICT (student_id, event_type, reference_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- 10. New: Evaluation XP trigger
CREATE OR REPLACE FUNCTION public.grant_xp_on_evaluation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_xp integer;
  v_level_id uuid;
BEGIN
  IF NEW.percentage IS NOT NULL AND NEW.percentage > 0 THEN
    SELECT s.level_id INTO v_level_id FROM sessions s WHERE s.id = NEW.session_id;

    v_xp := ROUND((NEW.percentage / 100.0) * 30);
    IF v_xp < 1 THEN v_xp := 1; END IF;

    INSERT INTO student_xp_events (student_id, event_type, xp_amount, reference_id, level_id)
    VALUES (NEW.student_id, 'evaluation', v_xp, NEW.id, v_level_id)
    ON CONFLICT (student_id, event_type, reference_id) DO UPDATE
      SET xp_amount = EXCLUDED.xp_amount;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_xp_on_evaluation
  AFTER INSERT OR UPDATE ON public.session_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_xp_on_evaluation();

-- 11. New: Level completion XP trigger
CREATE OR REPLACE FUNCTION public.grant_xp_on_level_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_xp integer;
BEGIN
  -- Only fire when outcome changes to a final state
  IF NEW.outcome IS NOT NULL AND (OLD.outcome IS NULL OR OLD.outcome != NEW.outcome) THEN
    IF NEW.outcome = 'passed' THEN
      v_xp := 200;
    ELSIF NEW.outcome IN ('failed_exam', 'failed_total') THEN
      v_xp := 50;
    ELSE
      RETURN NEW;
    END IF;

    INSERT INTO student_xp_events (student_id, event_type, xp_amount, reference_id, level_id)
    VALUES (NEW.student_id, 'level_completion', v_xp, NEW.id, NEW.current_level_id)
    ON CONFLICT (student_id, event_type, reference_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_xp_on_level_completion
  AFTER UPDATE ON public.group_student_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_xp_on_level_completion();

-- 12. RPC: get_student_level_xp
CREATE OR REPLACE FUNCTION public.get_student_level_xp(p_student_id uuid)
RETURNS TABLE (
  level_id uuid,
  level_name text,
  level_name_ar text,
  total_xp bigint,
  rank_name text,
  rank_progress integer,
  attendance_xp bigint,
  evaluation_xp bigint,
  quiz_xp bigint,
  assignment_xp bigint,
  completion_xp bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id AS level_id,
    l.name AS level_name,
    l.name_ar AS level_name_ar,
    COALESCE(SUM(xe.xp_amount), 0) AS total_xp,
    CASE
      WHEN COALESCE(SUM(xe.xp_amount), 0) >= 1400 THEN 'Legend'
      WHEN COALESCE(SUM(xe.xp_amount), 0) >= 900 THEN 'Champion'
      WHEN COALESCE(SUM(xe.xp_amount), 0) >= 500 THEN 'Warrior'
      WHEN COALESCE(SUM(xe.xp_amount), 0) >= 200 THEN 'Explorer'
      ELSE 'Rookie'
    END AS rank_name,
    CASE
      WHEN COALESCE(SUM(xe.xp_amount), 0) >= 1400 THEN 100
      WHEN COALESCE(SUM(xe.xp_amount), 0) >= 900 THEN ((COALESCE(SUM(xe.xp_amount), 0) - 900)::integer * 100 / 500)
      WHEN COALESCE(SUM(xe.xp_amount), 0) >= 500 THEN ((COALESCE(SUM(xe.xp_amount), 0) - 500)::integer * 100 / 400)
      WHEN COALESCE(SUM(xe.xp_amount), 0) >= 200 THEN ((COALESCE(SUM(xe.xp_amount), 0) - 200)::integer * 100 / 300)
      ELSE (COALESCE(SUM(xe.xp_amount), 0)::integer * 100 / 200)
    END AS rank_progress,
    COALESCE(SUM(xe.xp_amount) FILTER (WHERE xe.event_type = 'attendance'), 0) AS attendance_xp,
    COALESCE(SUM(xe.xp_amount) FILTER (WHERE xe.event_type = 'evaluation'), 0) AS evaluation_xp,
    COALESCE(SUM(xe.xp_amount) FILTER (WHERE xe.event_type = 'quiz_score'), 0) AS quiz_xp,
    COALESCE(SUM(xe.xp_amount) FILTER (WHERE xe.event_type = 'assignment_score'), 0) AS assignment_xp,
    COALESCE(SUM(xe.xp_amount) FILTER (WHERE xe.event_type = 'level_completion'), 0) AS completion_xp
  FROM public.levels l
  JOIN public.student_xp_events xe ON xe.level_id = l.id AND xe.student_id = p_student_id
  GROUP BY l.id, l.name, l.name_ar
  ORDER BY total_xp DESC;
$$;
