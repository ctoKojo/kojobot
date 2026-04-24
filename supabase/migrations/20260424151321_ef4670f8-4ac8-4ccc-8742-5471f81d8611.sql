-- 1) Tighten prevent_far_future_sessions: consider scheduled too, and lower limit
CREATE OR REPLACE FUNCTION public.prevent_far_future_sessions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_last_real_date DATE;
  v_max_allowed DATE;
BEGIN
  -- Only on INSERT, only for non-cancelled, non-makeup sessions
  IF TG_OP <> 'INSERT' OR NEW.status = 'cancelled' OR NEW.is_makeup IS TRUE THEN
    RETURN NEW;
  END IF;

  -- Use MAX of completed OR scheduled (excluding makeup) as the anchor
  -- This prevents cascading bad dates: if a previous bad scheduled date exists,
  -- it would otherwise be ignored and the new far-future date would slip through
  SELECT MAX(session_date)
  INTO v_last_real_date
  FROM public.sessions
  WHERE group_id = NEW.group_id
    AND status IN ('completed', 'scheduled')
    AND is_makeup IS NOT TRUE
    AND session_number IS NOT NULL;

  -- If nothing exists yet (first session being inserted), allow
  IF v_last_real_date IS NULL THEN
    RETURN NEW;
  END IF;

  -- Max allowed: 14 days after the latest existing real session
  -- (covers normal weekly cadence + 1 closure week buffer)
  v_max_allowed := v_last_real_date + INTERVAL '14 days';

  IF NEW.session_date > v_max_allowed THEN
    RAISE EXCEPTION 'Session date % is too far in the future for group %. Latest existing session is %, max allowed is %.',
      NEW.session_date, NEW.group_id, v_last_real_date, v_max_allowed
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Harden auto_generate_next_session to base its date on the LAST COMPLETED session
--    (or earliest scheduled if no completed exists) instead of MAX of all sessions.
--    This prevents bad scheduled future dates from cascading.
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
  v_distinct_completed INTEGER;
  v_owed INTEGER;
  v_anchor_date DATE;
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
         g.level_id, g.last_delivered_content_number, g.owed_sessions_count,
         g.status, g.level_status
  INTO v_group
  FROM groups g WHERE g.id = NEW.group_id;

  IF NOT v_group.is_active THEN
    RETURN NEW;
  END IF;

  IF v_group.status = 'frozen' THEN
    RETURN NEW;
  END IF;

  IF v_group.level_status IS NOT NULL AND v_group.level_status != 'in_progress' THEN
    RETURN NEW;
  END IF;

  SELECT l.expected_sessions_count INTO v_expected_sessions
  FROM levels l WHERE l.id = v_group.level_id;
  v_expected_sessions := COALESCE(v_expected_sessions, 12);

  v_is_closure_cancel := (NEW.status = 'cancelled' AND COALESCE(NEW.cancellation_reason, '') = 'academy_closure');

  SELECT last_delivered_content_number, owed_sessions_count
  INTO v_last_content, v_owed
  FROM groups WHERE id = NEW.group_id;
  v_last_content := COALESCE(v_last_content, 0);
  v_owed := COALESCE(v_owed, 0);

  SELECT COUNT(DISTINCT s.content_number) INTO v_distinct_completed
  FROM sessions s
  WHERE s.group_id = NEW.group_id
    AND s.status = 'completed'
    AND s.is_makeup = false
    AND s.content_number IS NOT NULL
    AND s.content_number >= 1
    AND s.content_number <= v_expected_sessions;

  IF v_distinct_completed >= v_expected_sessions THEN
    RETURN NEW;
  END IF;

  -- Compute next session_number
  SELECT COALESCE(MAX(s.session_number), 0) + 1 INTO v_next_session_number
  FROM sessions s
  WHERE s.group_id = NEW.group_id
    AND s.is_makeup IS NOT TRUE;

  -- Compute next content_number
  IF v_is_closure_cancel THEN
    v_next_content_number := COALESCE(NEW.content_number, v_last_content + 1);
  ELSE
    IF NEW.status = 'completed' THEN
      v_next_content_number := COALESCE(v_last_content, 0) + 1;
    ELSE
      v_next_content_number := COALESCE(NEW.content_number, v_last_content + 1);
    END IF;
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

  -- *** FIX: anchor date should be the LAST COMPLETED non-makeup session, not MAX of all ***
  -- This prevents cascading bad scheduled dates.
  -- Fallback: if no completed yet, use the triggering NEW.session_date.
  SELECT MAX(s.session_date) INTO v_anchor_date
  FROM sessions s
  WHERE s.group_id = NEW.group_id
    AND s.is_makeup IS NOT TRUE
    AND s.status = 'completed'
    AND s.session_number IS NOT NULL;

  v_anchor_date := COALESCE(v_anchor_date, NEW.session_date);

  v_target_dow := CASE v_group.schedule_day
    WHEN 'Sunday'    THEN 0
    WHEN 'Monday'    THEN 1
    WHEN 'Tuesday'   THEN 2
    WHEN 'Wednesday' THEN 3
    WHEN 'Thursday'  THEN 4
    WHEN 'Friday'    THEN 5
    WHEN 'Saturday'  THEN 6
    ELSE EXTRACT(DOW FROM v_anchor_date)::INTEGER
  END;

  v_current_dow := EXTRACT(DOW FROM v_anchor_date)::INTEGER;
  v_days_ahead := (v_target_dow - v_current_dow + 7) % 7;
  IF v_days_ahead = 0 THEN
    v_days_ahead := 7;
  END IF;

  v_next_session_date := v_anchor_date + v_days_ahead;

  -- Skip academy closure dates
  v_skip_iter := 0;
  LOOP
    EXIT WHEN v_skip_iter > 20;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM academy_closures ac
      WHERE v_next_session_date BETWEEN ac.start_date AND ac.end_date
        AND (
          ac.affects_all_groups IS TRUE
          OR EXISTS (
            SELECT 1 FROM academy_closure_groups acg
            WHERE acg.closure_id = ac.id AND acg.group_id = NEW.group_id
          )
        )
    );
    v_next_session_date := v_next_session_date + 7;
    v_skip_iter := v_skip_iter + 1;
  END LOOP;

  -- *** FIX: Don't insert a session that already exists (idempotency) ***
  IF EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.group_id = NEW.group_id
      AND s.session_number = v_next_session_number
      AND s.is_makeup IS NOT TRUE
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO sessions (
    group_id, session_number, session_date, session_time,
    duration_minutes, status, is_makeup, level_id, content_number
  ) VALUES (
    NEW.group_id,
    v_next_session_number,
    v_next_session_date,
    v_group.schedule_time,
    v_group.duration_minutes,
    'scheduled',
    FALSE,
    v_group.level_id,
    LEAST(v_next_content_number, v_expected_sessions)
  );

  RETURN NEW;
END;
$function$;