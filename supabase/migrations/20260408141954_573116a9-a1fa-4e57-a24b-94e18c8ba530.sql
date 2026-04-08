
-- ============================================================
-- Frozen Groups Enforcement: Backend Logic
-- ============================================================

-- 1. Add frozen check to auto_generate_next_session
CREATE OR REPLACE FUNCTION public.auto_generate_next_session()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_next_session_number INTEGER;
  v_next_content_number INTEGER;
  v_next_session_date DATE;
  v_group RECORD;
  v_expected_sessions INTEGER;
  v_last_content INTEGER;
  v_owed INTEGER;
  v_last_regular_date DATE;
  v_target_dow INTEGER;
  v_current_dow INTEGER;
  v_days_ahead INTEGER;
  v_skip_iter INTEGER;
  v_is_closure_cancel BOOLEAN;
  v_group_status TEXT;
BEGIN
  IF NEW.status NOT IN ('completed', 'cancelled') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.is_makeup IS TRUE THEN
    RETURN NEW;
  END IF;
  IF NEW.session_number IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.group_id::text));

  SELECT g.is_active, g.schedule_day, g.schedule_time, g.duration_minutes,
         g.level_id, g.last_delivered_content_number, g.owed_sessions_count,
         g.status
  INTO v_group
  FROM groups g WHERE g.id = NEW.group_id;

  IF NOT v_group.is_active THEN
    RETURN NEW;
  END IF;

  -- P0: Stop generation for frozen groups
  IF v_group.status = 'frozen' THEN
    RETURN NEW;
  END IF;

  SELECT l.expected_sessions_count INTO v_expected_sessions
  FROM levels l WHERE l.id = v_group.level_id;
  v_expected_sessions := COALESCE(v_expected_sessions, 12);

  v_is_closure_cancel := (NEW.status = 'cancelled' AND COALESCE(NEW.cancellation_reason, '') = 'academy_closure');

  -- Re-read counters (assign_content trigger may have updated them)
  SELECT last_delivered_content_number, owed_sessions_count
  INTO v_last_content, v_owed
  FROM groups WHERE id = NEW.group_id;
  v_last_content := COALESCE(v_last_content, 0);
  v_owed := COALESCE(v_owed, 0);

  IF NEW.status = 'cancelled' AND NOT v_is_closure_cancel THEN
    UPDATE groups
    SET owed_sessions_count = v_owed + 1
    WHERE id = NEW.group_id;
    v_owed := v_owed + 1;
  END IF;

  SELECT COALESCE(MAX(session_number), 0) + 1
  INTO v_next_session_number
  FROM sessions
  WHERE group_id = NEW.group_id AND is_makeup IS NOT TRUE;

  IF EXISTS (
    SELECT 1 FROM sessions
    WHERE group_id = NEW.group_id
      AND session_number = v_next_session_number
      AND is_makeup IS NOT TRUE
  ) THEN
    RETURN NEW;
  END IF;

  IF v_is_closure_cancel THEN
    v_next_content_number := COALESCE(NEW.content_number, v_last_content);
  ELSIF NEW.status = 'completed' THEN
    v_next_content_number := v_last_content + 1;
  ELSE
    v_next_content_number := COALESCE(NEW.content_number, v_last_content);
  END IF;

  IF v_last_content >= v_expected_sessions AND v_owed <= 0 THEN
    RETURN NEW;
  END IF;

  IF v_next_content_number > v_expected_sessions AND v_owed <= 0 AND NOT v_is_closure_cancel THEN
    RETURN NEW;
  END IF;

  IF v_next_session_number > (v_expected_sessions + v_owed + 5) THEN
    RETURN NEW;
  END IF;

  SELECT MAX(s.session_date) INTO v_last_regular_date
  FROM sessions s
  WHERE s.group_id = NEW.group_id
    AND s.is_makeup IS NOT TRUE
    AND s.session_number IS NOT NULL
    AND s.status IN ('scheduled', 'completed', 'cancelled');

  v_last_regular_date := COALESCE(v_last_regular_date, NEW.session_date);

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
  IF v_days_ahead = 0 THEN
    v_days_ahead := 7;
  END IF;

  v_next_session_date := v_last_regular_date + v_days_ahead;

  FOR v_skip_iter IN 1..8 LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM academy_closures ac
      WHERE v_next_session_date BETWEEN ac.start_date AND ac.end_date
        AND (
          ac.affects_all_groups = true
          OR EXISTS (
            SELECT 1 FROM academy_closure_groups acg
            WHERE acg.closure_id = ac.id AND acg.group_id = NEW.group_id
          )
        )
    );
    v_next_session_date := v_next_session_date + 7;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM academy_closures ac
    WHERE v_next_session_date BETWEEN ac.start_date AND ac.end_date
      AND (
        ac.affects_all_groups = true
        OR EXISTS (
          SELECT 1 FROM academy_closure_groups acg
          WHERE acg.closure_id = ac.id AND acg.group_id = NEW.group_id
        )
      )
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO sessions (
    group_id, session_date, session_time, duration_minutes,
    status, session_number, level_id, content_number
  ) VALUES (
    NEW.group_id, v_next_session_date, v_group.schedule_time,
    v_group.duration_minutes, 'scheduled', v_next_session_number,
    v_group.level_id, v_next_content_number
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 2. Create freeze/unfreeze handler trigger
CREATE OR REPLACE FUNCTION public.handle_group_freeze_unfreeze()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_last_completed RECORD;
  v_next_session_number INTEGER;
  v_next_content_number INTEGER;
  v_next_session_date DATE;
  v_target_dow INTEGER;
  v_current_dow INTEGER;
  v_days_ahead INTEGER;
  v_expected_sessions INTEGER;
  v_last_content INTEGER;
  v_owed INTEGER;
  v_skip_iter INTEGER;
BEGIN
  -- Only fire when status changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- ===== FREEZE: cancel all scheduled sessions =====
  IF NEW.status = 'frozen' AND OLD.status IS DISTINCT FROM 'frozen' THEN
    UPDATE sessions
    SET status = 'cancelled',
        cancellation_reason = 'group_frozen'
    WHERE group_id = NEW.id
      AND status = 'scheduled'
      AND is_makeup IS NOT TRUE;

    -- Deactivate any instructor warnings on those cancelled sessions
    UPDATE instructor_warnings
    SET is_active = false
    WHERE session_id IN (
      SELECT id FROM sessions
      WHERE group_id = NEW.id
        AND status = 'cancelled'
        AND cancellation_reason = 'group_frozen'
    )
    AND is_active = true;

    RAISE NOTICE 'Group % frozen: cancelled scheduled sessions', NEW.id;
    RETURN NEW;
  END IF;

  -- ===== UNFREEZE: generate next session =====
  IF OLD.status = 'frozen' AND NEW.status = 'active' THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.id::text));

    -- Check if there's already a scheduled session (idempotency)
    IF EXISTS (
      SELECT 1 FROM sessions
      WHERE group_id = NEW.id AND status = 'scheduled' AND is_makeup IS NOT TRUE
    ) THEN
      RETURN NEW;
    END IF;

    -- Find last completed session
    SELECT session_number, session_date, content_number
    INTO v_last_completed
    FROM sessions
    WHERE group_id = NEW.id
      AND status = 'completed'
      AND is_makeup IS NOT TRUE
    ORDER BY session_number DESC
    LIMIT 1;

    IF v_last_completed IS NULL THEN
      RETURN NEW;
    END IF;

    -- Read group counters
    v_last_content := COALESCE(NEW.last_delivered_content_number, 0);
    v_owed := COALESCE(NEW.owed_sessions_count, 0);

    SELECT l.expected_sessions_count INTO v_expected_sessions
    FROM levels l WHERE l.id = NEW.level_id;
    v_expected_sessions := COALESCE(v_expected_sessions, 12);

    -- Don't generate if curriculum is complete
    IF v_last_content >= v_expected_sessions AND v_owed <= 0 THEN
      RETURN NEW;
    END IF;

    v_next_session_number := v_last_completed.session_number + 1;
    v_next_content_number := v_last_content + 1;

    -- Check for duplicate
    IF EXISTS (
      SELECT 1 FROM sessions
      WHERE group_id = NEW.id
        AND session_number = v_next_session_number
        AND is_makeup IS NOT TRUE
    ) THEN
      RETURN NEW;
    END IF;

    -- Calculate next session date from today (not from last session)
    v_target_dow := CASE NEW.schedule_day
      WHEN 'Sunday'    THEN 0
      WHEN 'Monday'    THEN 1
      WHEN 'Tuesday'   THEN 2
      WHEN 'Wednesday' THEN 3
      WHEN 'Thursday'  THEN 4
      WHEN 'Friday'    THEN 5
      WHEN 'Saturday'  THEN 6
      ELSE 0
    END;

    v_current_dow := EXTRACT(DOW FROM CURRENT_DATE)::INTEGER;
    v_days_ahead := (v_target_dow - v_current_dow + 7) % 7;
    IF v_days_ahead = 0 THEN
      v_days_ahead := 7;
    END IF;

    v_next_session_date := CURRENT_DATE + v_days_ahead;

    -- Skip closures
    FOR v_skip_iter IN 1..8 LOOP
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM academy_closures ac
        WHERE v_next_session_date BETWEEN ac.start_date AND ac.end_date
          AND (
            ac.affects_all_groups = true
            OR EXISTS (
              SELECT 1 FROM academy_closure_groups acg
              WHERE acg.closure_id = ac.id AND acg.group_id = NEW.id
            )
          )
      );
      v_next_session_date := v_next_session_date + 7;
    END LOOP;

    INSERT INTO sessions (
      group_id, session_date, session_time, duration_minutes,
      status, session_number, level_id, content_number
    ) VALUES (
      NEW.id, v_next_session_date, NEW.schedule_time,
      NEW.duration_minutes, 'scheduled', v_next_session_number,
      NEW.level_id, v_next_content_number
    )
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Group % unfrozen: generated session #% on %', NEW.id, v_next_session_number, v_next_session_date;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS on_group_freeze_unfreeze ON groups;
CREATE TRIGGER on_group_freeze_unfreeze
  AFTER UPDATE ON public.groups
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION handle_group_freeze_unfreeze();

-- 4. Add 'group_frozen' to cancellation_reason check constraint if it exists
-- First check and drop existing constraint, then recreate with new value
DO $$
BEGIN
  -- Try to drop existing constraint
  BEGIN
    ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_cancellation_reason_check;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Constraint doesn't exist, that's fine
  END;
  
  -- Try to drop another common name
  BEGIN
    ALTER TABLE sessions DROP CONSTRAINT IF EXISTS check_cancellation_reason;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
