
-- ============================================================
-- Academy Closures System
-- ============================================================

-- 1. academy_closures table
CREATE TABLE public.academy_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  reason_ar TEXT,
  affects_all_groups BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger: end_date >= start_date
CREATE OR REPLACE FUNCTION public.validate_academy_closure()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'end_date must be >= start_date';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_academy_closure
  BEFORE INSERT OR UPDATE ON public.academy_closures
  FOR EACH ROW EXECUTE FUNCTION public.validate_academy_closure();

-- RLS
ALTER TABLE public.academy_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage closures"
  ON public.academy_closures FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view closures"
  ON public.academy_closures FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 2. academy_closure_groups table
CREATE TABLE public.academy_closure_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closure_id UUID NOT NULL REFERENCES public.academy_closures(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE
);

ALTER TABLE public.academy_closure_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage closure groups"
  ON public.academy_closure_groups FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view closure groups"
  ON public.academy_closure_groups FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 3. session_cancellation_logs table
CREATE TABLE public.session_cancellation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  closure_id UUID NOT NULL REFERENCES public.academy_closures(id) ON DELETE CASCADE,
  cancelled_by UUID REFERENCES auth.users(id),
  cancelled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  replacement_session_id UUID REFERENCES public.sessions(id),
  notification_sent BOOLEAN NOT NULL DEFAULT false,
  notification_sent_at TIMESTAMPTZ,
  UNIQUE(session_id, closure_id)
);

ALTER TABLE public.session_cancellation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage cancellation logs"
  ON public.session_cancellation_logs FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. Add cancellation_reason to sessions
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Validation trigger for cancellation_reason
CREATE OR REPLACE FUNCTION public.validate_session_cancellation_reason()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.cancellation_reason IS NOT NULL AND NEW.cancellation_reason NOT IN (
    'academy_closure', 'instructor_absent', 'student_request', 'technical_issue', 'other'
  ) THEN
    RAISE EXCEPTION 'Invalid cancellation_reason: %', NEW.cancellation_reason;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_cancellation_reason
  BEFORE INSERT OR UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.validate_session_cancellation_reason();

-- 5. Update auto_generate_next_session to skip closure dates
CREATE OR REPLACE FUNCTION public.auto_generate_next_session()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
DECLARE
  v_next_session_number INTEGER;
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
BEGIN
  -- Only fire on completed or cancelled
  IF NEW.status NOT IN ('completed', 'cancelled') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Ignore makeup sessions entirely
  IF NEW.is_makeup IS TRUE THEN
    RETURN NEW;
  END IF;

  -- Must have a session_number
  IF NEW.session_number IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get group info + level expected sessions
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

  -- Read latest group state (may have been updated by a_assign_content_on_complete)
  SELECT last_delivered_content_number, owed_sessions_count
  INTO v_last_content, v_owed
  FROM groups WHERE id = NEW.group_id;

  -- ======== CANCELLED: increment session_number + increment owed ========
  IF NEW.status = 'cancelled' THEN
    UPDATE groups
    SET owed_sessions_count = COALESCE(owed_sessions_count, 0) + 1
    WHERE id = NEW.group_id;

    v_owed := COALESCE(v_owed, 0) + 1;
  END IF;

  -- Both completed and cancelled generate session_number + 1
  v_next_session_number := NEW.session_number + 1;

  -- ======== STOP CONDITION ========
  IF v_last_content >= v_expected_sessions AND v_owed <= 0 THEN
    RETURN NEW;
  END IF;

  IF v_next_session_number > (v_expected_sessions + v_owed + 5) THEN
    RETURN NEW;
  END IF;

  -- Check if a non-cancelled session with this number already exists
  IF EXISTS (
    SELECT 1 FROM sessions
    WHERE group_id = NEW.group_id
      AND session_number = v_next_session_number
      AND is_makeup IS NOT TRUE
      AND status != 'cancelled'
  ) THEN
    RETURN NEW;
  END IF;

  -- Calculate next date from weekly schedule
  SELECT MAX(s.session_date) INTO v_last_regular_date
  FROM sessions s
  WHERE s.group_id = NEW.group_id
    AND s.is_makeup IS NOT TRUE
    AND s.session_number IS NOT NULL
    AND s.status IN ('scheduled', 'completed', 'cancelled');

  v_last_regular_date := COALESCE(v_last_regular_date, NEW.session_date);

  -- Map schedule_day to DOW
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

  -- ======== CLOSURE SKIP LOOP (max 8 iterations) ========
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

  -- If after 8 skips still in closure, don't create session
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
    group_id, session_date, session_time, duration_minutes, status, session_number, level_id
  ) VALUES (
    NEW.group_id, v_next_session_date, v_group.schedule_time, v_group.duration_minutes,
    'scheduled', v_next_session_number, v_group.level_id
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Recreate trigger (same definition)
DROP TRIGGER IF EXISTS on_session_status_change ON public.sessions;
CREATE TRIGGER on_session_status_change
  AFTER UPDATE ON public.sessions
  FOR EACH ROW
  WHEN (
    NEW.status IN ('completed', 'cancelled')
    AND OLD.status IS DISTINCT FROM NEW.status
  )
  EXECUTE FUNCTION public.auto_generate_next_session();
