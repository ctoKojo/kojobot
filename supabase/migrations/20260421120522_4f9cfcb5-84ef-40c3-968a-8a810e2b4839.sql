
-- ============================================================================
-- LAYER 1: Prevent session_number gaps
-- ============================================================================
CREATE OR REPLACE FUNCTION public.prevent_session_number_gaps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_existing INTEGER;
  v_expected INTEGER;
BEGIN
  -- Only check on INSERT (not updates)
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Skip if this is session #1 (first session of group)
  IF NEW.session_number = 1 THEN
    RETURN NEW;
  END IF;

  -- Get current max session_number for this group (excluding the new one)
  SELECT COALESCE(MAX(session_number), 0)
  INTO v_max_existing
  FROM public.sessions
  WHERE group_id = NEW.group_id;

  v_expected := v_max_existing + 1;

  -- Allow if it's the next sequential number, OR if filling a known gap
  IF NEW.session_number = v_expected THEN
    RETURN NEW;
  END IF;

  -- Allow backfilling gaps (smaller numbers that don't exist yet)
  IF NEW.session_number < v_expected THEN
    -- Check the slot is actually empty
    IF NOT EXISTS (
      SELECT 1 FROM public.sessions
      WHERE group_id = NEW.group_id AND session_number = NEW.session_number
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Forward gap: refuse
  RAISE EXCEPTION 'Cannot insert session #% for group %. Next expected number is #%. Fill missing sessions first.',
    NEW.session_number, NEW.group_id, v_expected
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS prevent_session_gaps_trg ON public.sessions;
CREATE TRIGGER prevent_session_gaps_trg
  BEFORE INSERT ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_session_number_gaps();


-- ============================================================================
-- LAYER 2: Prevent far-future session dates
-- ============================================================================
CREATE OR REPLACE FUNCTION public.prevent_far_future_sessions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_completed_date DATE;
  v_max_allowed DATE;
BEGIN
  -- Only on INSERT, only for non-cancelled sessions
  IF TG_OP <> 'INSERT' OR NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Get last completed session date for this group
  SELECT MAX(session_date)
  INTO v_last_completed_date
  FROM public.sessions
  WHERE group_id = NEW.group_id
    AND status = 'completed';

  -- If no completed sessions yet, allow (group just starting)
  IF v_last_completed_date IS NULL THEN
    RETURN NEW;
  END IF;

  -- Max allowed: last completed + 4 weeks (28 days)
  v_max_allowed := v_last_completed_date + INTERVAL '28 days';

  IF NEW.session_date > v_max_allowed THEN
    RAISE EXCEPTION 'Session date % is too far in the future. Last completed session was %, max allowed is %. Use makeup_sessions or sequential generation instead.',
      NEW.session_date, v_last_completed_date, v_max_allowed
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_far_future_sessions_trg ON public.sessions;
CREATE TRIGGER prevent_far_future_sessions_trg
  BEFORE INSERT ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_far_future_sessions();


-- ============================================================================
-- LAYER 3: Auto-sync group counters when session completes
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_group_counters_on_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_content INTEGER;
BEGIN
  -- Only act when status transitions TO completed
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN
    RETURN NEW; -- already completed, no change
  END IF;

  -- Recalculate max content_number from all completed sessions in this group
  SELECT COALESCE(MAX(content_number), 0)
  INTO v_max_content
  FROM public.sessions
  WHERE group_id = NEW.group_id
    AND status = 'completed'
    AND content_number IS NOT NULL;

  -- Include the current row (in case it has a higher content_number)
  IF NEW.content_number IS NOT NULL AND NEW.content_number > v_max_content THEN
    v_max_content := NEW.content_number;
  END IF;

  -- Update group counter (only if higher — never go backward)
  UPDATE public.groups
  SET last_delivered_content_number = GREATEST(
        COALESCE(last_delivered_content_number, 0),
        v_max_content
      ),
      updated_at = NOW()
  WHERE id = NEW.group_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_group_counters_trg ON public.sessions;
CREATE TRIGGER sync_group_counters_trg
  AFTER INSERT OR UPDATE OF status, content_number ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_group_counters_on_complete();


-- ============================================================================
-- LAYER 4: Daily validation function + data_quality_issues integration
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_group_timeline()
RETURNS TABLE (
  group_id UUID,
  group_name TEXT,
  issue_type TEXT,
  details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group RECORD;
  v_gap_numbers INTEGER[];
  v_actual_max_content INTEGER;
  v_orphan_makeup_count INTEGER;
  v_last_completed_date DATE;
  v_days_since INTEGER;
BEGIN
  FOR v_group IN
    SELECT g.id, g.name, g.last_delivered_content_number, g.owed_sessions_count
    FROM public.groups g
    WHERE g.is_active = true
      AND g.has_started = true
      AND g.status <> 'frozen'
  LOOP
    -- Check 1: Find session_number gaps
    SELECT ARRAY(
      SELECT generate_series(1, COALESCE(MAX(s.session_number), 0))
      FROM public.sessions s
      WHERE s.group_id = v_group.id
      EXCEPT
      SELECT s.session_number
      FROM public.sessions s
      WHERE s.group_id = v_group.id
    ) INTO v_gap_numbers;

    IF array_length(v_gap_numbers, 1) > 0 THEN
      INSERT INTO public.data_quality_issues (entity_table, entity_id, issue_type, details)
      VALUES (
        'groups', v_group.id, 'session_number_gap',
        jsonb_build_object(
          'group_name', v_group.name,
          'missing_session_numbers', v_gap_numbers
        )
      )
      ON CONFLICT DO NOTHING;

      RETURN QUERY SELECT v_group.id, v_group.name, 'session_number_gap'::TEXT,
        jsonb_build_object('missing', v_gap_numbers);
    END IF;

    -- Check 2: Counter mismatch
    SELECT COALESCE(MAX(content_number), 0)
    INTO v_actual_max_content
    FROM public.sessions
    WHERE group_id = v_group.id
      AND status = 'completed'
      AND content_number IS NOT NULL;

    IF COALESCE(v_group.last_delivered_content_number, 0) <> v_actual_max_content THEN
      INSERT INTO public.data_quality_issues (entity_table, entity_id, issue_type, details)
      VALUES (
        'groups', v_group.id, 'counter_mismatch',
        jsonb_build_object(
          'group_name', v_group.name,
          'cached', v_group.last_delivered_content_number,
          'actual', v_actual_max_content
        )
      )
      ON CONFLICT DO NOTHING;

      RETURN QUERY SELECT v_group.id, v_group.name, 'counter_mismatch'::TEXT,
        jsonb_build_object('cached', v_group.last_delivered_content_number, 'actual', v_actual_max_content);
    END IF;

    -- Check 3: Stale group (>14 days since last completed session, no upcoming scheduled)
    SELECT MAX(session_date) INTO v_last_completed_date
    FROM public.sessions
    WHERE group_id = v_group.id AND status = 'completed';

    IF v_last_completed_date IS NOT NULL THEN
      v_days_since := (CURRENT_DATE - v_last_completed_date);
      IF v_days_since > 14 AND NOT EXISTS (
        SELECT 1 FROM public.sessions
        WHERE group_id = v_group.id
          AND status = 'scheduled'
          AND session_date >= CURRENT_DATE
      ) THEN
        INSERT INTO public.data_quality_issues (entity_table, entity_id, issue_type, details)
        VALUES (
          'groups', v_group.id, 'stale_no_upcoming',
          jsonb_build_object(
            'group_name', v_group.name,
            'last_completed_date', v_last_completed_date,
            'days_since', v_days_since
          )
        )
        ON CONFLICT DO NOTHING;

        RETURN QUERY SELECT v_group.id, v_group.name, 'stale_no_upcoming'::TEXT,
          jsonb_build_object('days_since', v_days_since);
      END IF;
    END IF;

    -- Check 4: Orphan makeup sessions
    SELECT COUNT(*) INTO v_orphan_makeup_count
    FROM public.makeup_sessions ms
    WHERE ms.original_session_id IN (
      SELECT id FROM public.sessions WHERE group_id = v_group.id
    )
    AND ms.status = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM public.attendance WHERE makeup_session_id = ms.id
    )
    AND ms.created_at < NOW() - INTERVAL '7 days';

    IF v_orphan_makeup_count > 0 THEN
      INSERT INTO public.data_quality_issues (entity_table, entity_id, issue_type, details)
      VALUES (
        'groups', v_group.id, 'orphan_makeup_sessions',
        jsonb_build_object(
          'group_name', v_group.name,
          'count', v_orphan_makeup_count
        )
      )
      ON CONFLICT DO NOTHING;

      RETURN QUERY SELECT v_group.id, v_group.name, 'orphan_makeup_sessions'::TEXT,
        jsonb_build_object('count', v_orphan_makeup_count);
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_group_timeline() TO authenticated;

-- Add new enum value for data_quality_issues if needed (gracefully)
DO $$
BEGIN
  -- Check if enum has our new values
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'data_quality_issue_type'::regtype
    AND enumlabel = 'session_number_gap'
  ) THEN
    ALTER TYPE data_quality_issue_type ADD VALUE IF NOT EXISTS 'session_number_gap';
    ALTER TYPE data_quality_issue_type ADD VALUE IF NOT EXISTS 'counter_mismatch';
    ALTER TYPE data_quality_issue_type ADD VALUE IF NOT EXISTS 'stale_no_upcoming';
    ALTER TYPE data_quality_issue_type ADD VALUE IF NOT EXISTS 'orphan_makeup_sessions';
  END IF;
EXCEPTION WHEN undefined_object THEN
  -- enum doesn't exist, skip (issue_type is probably TEXT)
  NULL;
END $$;
