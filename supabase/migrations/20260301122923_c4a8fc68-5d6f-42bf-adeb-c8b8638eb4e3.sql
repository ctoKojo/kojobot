
-- Function: Grant XP on attendance (present/late)
CREATE OR REPLACE FUNCTION public.grant_xp_on_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only grant XP for present or late status
  IF NEW.status IN ('present', 'late') THEN
    -- Check if XP already granted for this attendance
    IF NOT EXISTS (
      SELECT 1 FROM student_xp_events
      WHERE student_id = NEW.student_id
        AND event_type = 'attendance'
        AND reference_id = NEW.session_id
    ) THEN
      INSERT INTO student_xp_events (student_id, event_type, xp_amount, reference_id)
      VALUES (NEW.student_id, 'attendance', 50, NEW.session_id);

      -- Update streak
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

      -- Check attendance-based achievements
      PERFORM check_attendance_achievements(NEW.student_id);
      PERFORM check_streak_achievements(NEW.student_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Function: Grant XP on quiz grade
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
BEGIN
  -- Only on graded submissions
  IF NEW.status = 'graded' AND NEW.total_score IS NOT NULL THEN
    -- Check if XP already granted
    IF NOT EXISTS (
      SELECT 1 FROM student_xp_events
      WHERE student_id = NEW.student_id
        AND event_type = 'quiz_score'
        AND reference_id = NEW.id
    ) THEN
      v_max_score := COALESCE(NEW.max_total_score, 100);
      v_percentage := CASE WHEN v_max_score > 0 THEN (NEW.total_score::numeric / v_max_score) * 100 ELSE 0 END;
      v_xp := 20 + ROUND((v_percentage / 100.0) * 30);

      INSERT INTO student_xp_events (student_id, event_type, xp_amount, reference_id)
      VALUES (NEW.student_id, 'quiz_score', v_xp, NEW.id);

      -- Check quiz score achievements
      PERFORM check_quiz_achievements(NEW.student_id, v_percentage);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Function: Grant XP on assignment grade
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
BEGIN
  IF NEW.status = 'graded' AND NEW.score IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM student_xp_events
      WHERE student_id = NEW.student_id
        AND event_type = 'assignment_score'
        AND reference_id = NEW.id
    ) THEN
      -- Get max score from assignment
      SELECT COALESCE(a.max_score, 100) INTO v_max_score
      FROM assignments a WHERE a.id = NEW.assignment_id;

      v_percentage := CASE WHEN v_max_score > 0 THEN (NEW.score::numeric / v_max_score) * 100 ELSE 0 END;
      v_xp := 20 + ROUND((v_percentage / 100.0) * 30);

      INSERT INTO student_xp_events (student_id, event_type, xp_amount, reference_id)
      VALUES (NEW.student_id, 'assignment_score', v_xp, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Helper: Check attendance achievements
CREATE OR REPLACE FUNCTION public.check_attendance_achievements(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_achievement record;
BEGIN
  SELECT COUNT(DISTINCT reference_id) INTO v_count
  FROM student_xp_events
  WHERE student_id = p_student_id AND event_type = 'attendance';

  FOR v_achievement IN
    SELECT id, xp_reward, condition_value
    FROM achievements
    WHERE condition_type = 'attendance_count' AND is_active = true
  LOOP
    IF v_count >= (v_achievement.condition_value->>'count')::integer THEN
      INSERT INTO student_achievements (student_id, achievement_id)
      VALUES (p_student_id, v_achievement.id)
      ON CONFLICT (student_id, achievement_id) DO NOTHING;

      -- Grant achievement XP if newly inserted
      IF FOUND THEN
        INSERT INTO student_xp_events (student_id, event_type, xp_amount, reference_id)
        VALUES (p_student_id, 'achievement', v_achievement.xp_reward, v_achievement.id);
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Helper: Check streak achievements
CREATE OR REPLACE FUNCTION public.check_streak_achievements(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_streak integer;
  v_achievement record;
BEGIN
  SELECT current_streak INTO v_streak
  FROM student_streaks
  WHERE student_id = p_student_id;

  IF v_streak IS NULL THEN RETURN; END IF;

  FOR v_achievement IN
    SELECT id, xp_reward, condition_value
    FROM achievements
    WHERE condition_type = 'streak' AND is_active = true
  LOOP
    IF v_streak >= (v_achievement.condition_value->>'days')::integer THEN
      INSERT INTO student_achievements (student_id, achievement_id)
      VALUES (p_student_id, v_achievement.id)
      ON CONFLICT (student_id, achievement_id) DO NOTHING;

      IF FOUND THEN
        INSERT INTO student_xp_events (student_id, event_type, xp_amount, reference_id)
        VALUES (p_student_id, 'achievement', v_achievement.xp_reward, v_achievement.id);
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Helper: Check quiz achievements
CREATE OR REPLACE FUNCTION public.check_quiz_achievements(p_student_id uuid, p_percentage numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_achievement record;
BEGIN
  FOR v_achievement IN
    SELECT id, xp_reward, condition_value
    FROM achievements
    WHERE condition_type = 'quiz_score' AND is_active = true
  LOOP
    IF p_percentage >= (v_achievement.condition_value->>'min_percentage')::numeric THEN
      INSERT INTO student_achievements (student_id, achievement_id)
      VALUES (p_student_id, v_achievement.id)
      ON CONFLICT (student_id, achievement_id) DO NOTHING;

      IF FOUND THEN
        INSERT INTO student_xp_events (student_id, event_type, xp_amount, reference_id)
        VALUES (p_student_id, 'achievement', v_achievement.xp_reward, v_achievement.id);
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Attach triggers
CREATE TRIGGER trg_xp_on_attendance
  AFTER INSERT OR UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION grant_xp_on_attendance();

CREATE TRIGGER trg_xp_on_quiz_grade
  AFTER INSERT OR UPDATE ON public.quiz_submissions
  FOR EACH ROW EXECUTE FUNCTION grant_xp_on_quiz_grade();

CREATE TRIGGER trg_xp_on_assignment_grade
  AFTER INSERT OR UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION grant_xp_on_assignment_grade();
