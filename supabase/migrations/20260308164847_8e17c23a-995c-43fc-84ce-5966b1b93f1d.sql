
-- ============================================================
-- Migration: Support cancelled sessions in auto_generate_next_session
-- + Unique partial index for race condition protection
-- ============================================================

-- 1. Unique partial index to prevent duplicate regular sessions
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_group_session_number_unique
ON public.sessions (group_id, session_number)
WHERE is_makeup IS NOT TRUE AND session_number IS NOT NULL;

-- 2. Replace the function with all 4 conditions
CREATE OR REPLACE FUNCTION public.auto_generate_next_session()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  v_next_session_number INTEGER;
  v_next_session_date DATE;
  v_group RECORD;
  v_expected_sessions INTEGER;
  v_last_regular_date DATE;
  v_target_dow INTEGER;
  v_current_dow INTEGER;
  v_days_ahead INTEGER;
BEGIN
  -- Only fire on completed or cancelled (trigger WHEN clause ensures this, but double-check)
  IF NEW.status NOT IN ('completed', 'cancelled') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Condition 3: Ignore makeup sessions entirely
  IF NEW.is_makeup IS TRUE THEN
    RETURN NEW;
  END IF;

  -- Must have a session_number
  IF NEW.session_number IS NULL THEN
    RETURN NEW;
  END IF;

  -- Condition 4: Respect level's expected_sessions_count
  SELECT l.expected_sessions_count INTO v_expected_sessions
  FROM groups g JOIN levels l ON g.level_id = l.id
  WHERE g.id = NEW.group_id;

  v_expected_sessions := COALESCE(v_expected_sessions, 12);

  IF NEW.session_number >= v_expected_sessions THEN
    RETURN NEW;
  END IF;

  v_next_session_number := NEW.session_number + 1;

  -- Condition 2: Check if next session already exists (application-level guard)
  IF EXISTS (
    SELECT 1 FROM sessions
    WHERE group_id = NEW.group_id
      AND session_number = v_next_session_number
      AND is_makeup IS NOT TRUE
  ) THEN
    RETURN NEW;
  END IF;

  -- Get group info
  SELECT is_active, schedule_day, schedule_time, duration_minutes, level_id
  INTO v_group
  FROM groups WHERE id = NEW.group_id;

  IF NOT v_group.is_active THEN
    RETURN NEW;
  END IF;

  -- Condition 1: Calculate next date from weekly schedule, not session_date + 7
  -- Find the latest regular session date for this group
  -- Regular = non-makeup, has session_number, status is scheduled/completed/cancelled
  SELECT MAX(s.session_date) INTO v_last_regular_date
  FROM sessions s
  WHERE s.group_id = NEW.group_id
    AND s.is_makeup IS NOT TRUE
    AND s.session_number IS NOT NULL
    AND s.status IN ('scheduled', 'completed', 'cancelled');

  -- Fallback to current session date if nothing found
  v_last_regular_date := COALESCE(v_last_regular_date, NEW.session_date);

  -- Map schedule_day to DOW (0=Sunday, 6=Saturday)
  v_target_dow := CASE v_group.schedule_day
    WHEN 'Sunday'    THEN 0
    WHEN 'Monday'    THEN 1
    WHEN 'Tuesday'   THEN 2
    WHEN 'Wednesday' THEN 3
    WHEN 'Thursday'  THEN 4
    WHEN 'Friday'    THEN 5
    WHEN 'Saturday'  THEN 6
    ELSE EXTRACT(DOW FROM v_last_regular_date)::INTEGER
  END;

  v_current_dow := EXTRACT(DOW FROM v_last_regular_date)::INTEGER;
  v_days_ahead := (v_target_dow - v_current_dow + 7) % 7;
  -- If same day, go to next week
  IF v_days_ahead = 0 THEN
    v_days_ahead := 7;
  END IF;

  v_next_session_date := v_last_regular_date + v_days_ahead;

  -- Insert with ON CONFLICT DO NOTHING (database-level protection)
  INSERT INTO sessions (
    group_id, session_date, session_time, duration_minutes, status, session_number, level_id
  ) VALUES (
    NEW.group_id, v_next_session_date, v_group.schedule_time, v_group.duration_minutes,
    'scheduled', v_next_session_number, v_group.level_id
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3. Drop old triggers safely
DROP TRIGGER IF EXISTS on_session_completed ON public.sessions;
DROP TRIGGER IF EXISTS on_session_status_change ON public.sessions;

-- 4. Create new trigger for both completed and cancelled
CREATE TRIGGER on_session_status_change
  AFTER UPDATE ON public.sessions
  FOR EACH ROW
  WHEN (
    (NEW.status = 'completed' OR NEW.status = 'cancelled')
    AND OLD.status IS DISTINCT FROM NEW.status
  )
  EXECUTE FUNCTION public.auto_generate_next_session();
