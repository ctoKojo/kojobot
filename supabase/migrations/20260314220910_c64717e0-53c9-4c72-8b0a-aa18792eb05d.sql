
-- Create RPC function to repair orphaned cancelled sessions (missing next session)
CREATE OR REPLACE FUNCTION public.repair_orphaned_sessions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id UUID;
  v_rec RECORD;
  v_group RECORD;
  v_next_session_number INTEGER;
  v_last_regular_date DATE;
  v_target_dow INTEGER;
  v_current_dow INTEGER;
  v_days_ahead INTEGER;
  v_next_date DATE;
  v_fixes JSONB := '[]'::jsonb;
  v_count INTEGER := 0;
BEGIN
  v_caller_id := auth.uid();
  IF NOT has_role(v_caller_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  FOR v_rec IN
    SELECT s.id, s.group_id, s.session_number, s.session_date, s.level_id
    FROM sessions s
    WHERE s.status = 'cancelled'
      AND (s.is_makeup IS NOT TRUE)
      AND s.session_number IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM sessions s2
        WHERE s2.group_id = s.group_id
          AND s2.session_number = s.session_number + 1
          AND (s2.is_makeup IS NOT TRUE)
          AND s2.status != 'cancelled'
      )
  LOOP
    v_next_session_number := v_rec.session_number + 1;

    SELECT g.is_active, g.schedule_day, g.schedule_time, g.duration_minutes,
           g.level_id, g.owed_sessions_count
    INTO v_group
    FROM groups g
    WHERE g.id = v_rec.group_id;

    IF v_group IS NULL OR NOT v_group.is_active THEN
      CONTINUE;
    END IF;

    SELECT MAX(s2.session_date) INTO v_last_regular_date
    FROM sessions s2
    WHERE s2.group_id = v_rec.group_id
      AND s2.is_makeup IS NOT TRUE
      AND s2.session_number IS NOT NULL
      AND s2.status IN ('scheduled', 'completed', 'cancelled');

    v_last_regular_date := COALESCE(v_last_regular_date, v_rec.session_date);

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
    v_next_date := v_last_regular_date + v_days_ahead;

    INSERT INTO sessions (
      group_id, session_date, session_time, duration_minutes,
      status, session_number, level_id
    ) VALUES (
      v_rec.group_id, v_next_date, v_group.schedule_time, v_group.duration_minutes,
      'scheduled', v_next_session_number, v_group.level_id
    )
    ON CONFLICT DO NOTHING;

    UPDATE groups
    SET owed_sessions_count = COALESCE(owed_sessions_count, 0) + 1
    WHERE id = v_rec.group_id
      AND COALESCE(owed_sessions_count, 0) = 0;

    v_fixes := v_fixes || jsonb_build_object(
      'group_id', v_rec.group_id,
      'cancelled_session', v_rec.session_number,
      'new_session_number', v_next_session_number,
      'new_date', v_next_date
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('fixed', v_count, 'details', v_fixes);
END;
$$;
