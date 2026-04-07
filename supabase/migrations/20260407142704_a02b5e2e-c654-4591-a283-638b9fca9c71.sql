
-- ============================================================
-- STEP 1: Drop old triggers
-- ============================================================
DROP TRIGGER IF EXISTS a_assign_content_on_complete ON sessions;
DROP TRIGGER IF EXISTS on_session_status_change ON sessions;

-- ============================================================
-- STEP 2: Fix historical data — delete duplicate session_numbers
-- ============================================================
DELETE FROM sessions WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY group_id, session_number
      ORDER BY 
        CASE status WHEN 'completed' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,
        created_at DESC
    ) AS rn
    FROM sessions
    WHERE is_makeup IS NOT TRUE
  ) sub WHERE rn > 1
);

-- ============================================================
-- STEP 3: Rebuild content_number based on real attendance
-- ============================================================
WITH ordered AS (
  SELECT s.id, s.group_id, s.session_number, s.status,
    SUM(CASE 
      WHEN s.status = 'completed' AND (
        EXISTS (SELECT 1 FROM attendance a WHERE a.session_id = s.id AND a.status = 'present')
        OR NOT EXISTS (SELECT 1 FROM attendance a2 WHERE a2.session_id = s.id)
      ) THEN 1
      ELSE 0 
    END) OVER (
      PARTITION BY s.group_id ORDER BY s.session_number
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS new_content
  FROM sessions s
  WHERE s.is_makeup IS NOT TRUE
)
UPDATE sessions SET content_number = ordered.new_content
FROM ordered WHERE sessions.id = ordered.id;

-- ============================================================
-- STEP 4: Fix groups metadata
-- ============================================================
UPDATE groups SET starting_session_number = 1 WHERE has_started = true;

UPDATE groups g SET last_delivered_content_number = COALESCE((
  SELECT MAX(s.content_number) FROM sessions s
  WHERE s.group_id = g.id AND s.status = 'completed' AND s.is_makeup IS NOT TRUE
    AND (
      EXISTS (SELECT 1 FROM attendance a WHERE a.session_id = s.id AND a.status = 'present')
      OR NOT EXISTS (SELECT 1 FROM attendance a2 WHERE a2.session_id = s.id)
    )
), 0)
WHERE g.has_started = true;

UPDATE groups g SET last_delivered_content_number = 
  LEAST(g.last_delivered_content_number, COALESCE(l.expected_sessions_count, 12))
FROM levels l WHERE l.id = g.level_id AND g.has_started = true;

UPDATE groups g SET owed_sessions_count = GREATEST(0,
  COALESCE((SELECT expected_sessions_count FROM levels WHERE id = g.level_id), 12)
  - COALESCE(g.last_delivered_content_number, 0)
  - (SELECT COUNT(*) FROM sessions s WHERE s.group_id = g.id 
     AND s.status = 'scheduled' AND s.is_makeup IS NOT TRUE
     AND s.session_date >= CURRENT_DATE)
)
WHERE g.has_started = true AND g.is_active = true;

-- ============================================================
-- STEP 5: Add unique constraint on session_number only
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_session_number_per_group
ON sessions (group_id, session_number)
WHERE is_makeup IS NOT TRUE;

-- ============================================================
-- STEP 6: Rebuild assign_content_number_on_completion
-- ============================================================
CREATE OR REPLACE FUNCTION public.assign_content_number_on_completion()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_last_content INTEGER;
  v_owed INTEGER;
  v_has_present BOOLEAN;
  v_expected INTEGER;
BEGIN
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  IF (SELECT content_number FROM sessions WHERE id = NEW.id) IS NOT NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.group_id::text));

  SELECT EXISTS (
    SELECT 1 FROM attendance a WHERE a.session_id = NEW.id AND a.status = 'present'
  ) INTO v_has_present;

  SELECT last_delivered_content_number, owed_sessions_count
  INTO v_last_content, v_owed
  FROM groups
  WHERE id = NEW.group_id
  FOR UPDATE;

  SELECT COALESCE(l.expected_sessions_count, 12) INTO v_expected
  FROM levels l JOIN groups g ON g.level_id = l.id WHERE g.id = NEW.group_id;
  v_expected := COALESCE(v_expected, 12);

  IF v_has_present THEN
    UPDATE sessions
    SET content_number = LEAST(v_last_content + 1, v_expected)
    WHERE id = NEW.id;

    IF NEW.is_makeup IS TRUE THEN
      UPDATE groups
      SET last_delivered_content_number = LEAST(v_last_content + 1, v_expected),
          owed_sessions_count = GREATEST(0, COALESCE(v_owed, 0) - 1)
      WHERE id = NEW.group_id;
    ELSE
      UPDATE groups
      SET last_delivered_content_number = LEAST(v_last_content + 1, v_expected)
      WHERE id = NEW.group_id;
    END IF;
  ELSE
    UPDATE sessions
    SET content_number = v_last_content
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- STEP 7: Rebuild auto_generate_next_session
-- ============================================================
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
         g.level_id, g.last_delivered_content_number, g.owed_sessions_count
  INTO v_group
  FROM groups g WHERE g.id = NEW.group_id;

  IF NOT v_group.is_active THEN
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

-- ============================================================
-- STEP 8: Recreate triggers with WHEN clause
-- ============================================================
CREATE TRIGGER a_assign_content_on_complete
  AFTER UPDATE ON public.sessions
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION assign_content_number_on_completion();

CREATE TRIGGER on_session_status_change
  AFTER UPDATE ON public.sessions
  FOR EACH ROW
  WHEN ((NEW.status = ANY (ARRAY['completed', 'cancelled'])) AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION auto_generate_next_session();
