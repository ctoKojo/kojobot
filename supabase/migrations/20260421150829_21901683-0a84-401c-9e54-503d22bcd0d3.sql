
-- ============================================================
-- Auto-generate sessions row when a makeup_session is confirmed
-- ============================================================
-- Problem: Confirmed makeups (status='scheduled' with date/time/instructor)
-- did not produce a corresponding sessions row, so compliance-monitor
-- (which scans the `sessions` table) never saw them and never issued
-- warnings against the assigned instructor.
--
-- Fix:
--   1. Trigger on makeup_sessions AFTER INSERT/UPDATE that materializes
--      a sessions row with is_makeup=true once the makeup is fully booked
--      (status='scheduled' AND scheduled_date/time/assigned_instructor set).
--   2. Idempotent: re-runs are safe; existing rows are updated, not duplicated.
--   3. Cancellation: when makeup is cancelled, the synthetic session is also
--      cancelled (we do not delete to preserve history).
-- ============================================================

CREATE OR REPLACE FUNCTION public.materialize_makeup_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_session_id uuid;
  v_orig_session sessions%ROWTYPE;
  v_duration int;
  v_session_number int;
  v_content_number int;
  v_level_id uuid;
BEGIN
  -- Only act when the makeup is fully booked
  IF NEW.status NOT IN ('scheduled', 'completed', 'cancelled') THEN
    RETURN NEW;
  END IF;

  -- Cancellation path: mark synthetic session cancelled (if exists)
  IF NEW.status = 'cancelled' THEN
    UPDATE sessions
       SET status = 'cancelled', updated_at = now()
     WHERE makeup_session_id = NEW.id
       AND is_makeup = true
       AND status <> 'cancelled';
    RETURN NEW;
  END IF;

  -- Need date/time/instructor to materialize
  IF NEW.scheduled_date IS NULL OR NEW.scheduled_time IS NULL THEN
    RETURN NEW;
  END IF;

  -- Pull defaults from the original session
  SELECT * INTO v_orig_session FROM sessions WHERE id = NEW.original_session_id;
  v_duration := COALESCE(v_orig_session.duration_minutes, 60);
  v_session_number := v_orig_session.session_number;
  v_content_number := v_orig_session.content_number;
  v_level_id := COALESCE(NEW.level_id, v_orig_session.level_id);

  -- Idempotency: do we already have a session row for this makeup?
  SELECT id INTO v_existing_session_id
    FROM sessions
   WHERE makeup_session_id = NEW.id
   LIMIT 1;

  IF v_existing_session_id IS NOT NULL THEN
    -- Update in place if the makeup details changed
    UPDATE sessions
       SET session_date     = NEW.scheduled_date,
           session_time     = NEW.scheduled_time,
           duration_minutes = v_duration,
           level_id         = v_level_id,
           status           = CASE WHEN NEW.status = 'completed' THEN 'completed'
                                   WHEN status = 'cancelled' THEN status
                                   ELSE 'scheduled' END,
           updated_at       = now()
     WHERE id = v_existing_session_id;
    RETURN NEW;
  END IF;

  -- Create the synthetic makeup session row
  INSERT INTO sessions (
    group_id,
    session_date,
    session_time,
    duration_minutes,
    status,
    session_number,
    content_number,
    level_id,
    is_makeup,
    makeup_session_id
  )
  VALUES (
    NEW.group_id,
    NEW.scheduled_date,
    NEW.scheduled_time,
    v_duration,
    CASE WHEN NEW.status = 'completed' THEN 'completed' ELSE 'scheduled' END,
    v_session_number,
    v_content_number,
    v_level_id,
    true,
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_materialize_makeup_session ON public.makeup_sessions;
CREATE TRIGGER trg_materialize_makeup_session
AFTER INSERT OR UPDATE OF status, scheduled_date, scheduled_time, assigned_instructor_id, level_id
ON public.makeup_sessions
FOR EACH ROW
EXECUTE FUNCTION public.materialize_makeup_session();

-- ============================================================
-- Backfill: materialize sessions for all already-confirmed makeups
-- that don't have a sessions row yet
-- ============================================================
INSERT INTO sessions (
  group_id, session_date, session_time, duration_minutes,
  status, session_number, content_number, level_id,
  is_makeup, makeup_session_id
)
SELECT
  ms.group_id,
  ms.scheduled_date,
  ms.scheduled_time,
  COALESCE(os.duration_minutes, 60),
  CASE WHEN ms.status = 'completed' THEN 'completed' ELSE 'scheduled' END,
  os.session_number,
  os.content_number,
  COALESCE(ms.level_id, os.level_id),
  true,
  ms.id
FROM makeup_sessions ms
LEFT JOIN sessions os ON os.id = ms.original_session_id
WHERE ms.status IN ('scheduled', 'completed')
  AND ms.scheduled_date IS NOT NULL
  AND ms.scheduled_time IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sessions s
     WHERE s.makeup_session_id = ms.id
  );
