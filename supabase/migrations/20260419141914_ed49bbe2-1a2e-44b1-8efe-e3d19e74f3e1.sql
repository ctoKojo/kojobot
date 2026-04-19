-- ============================================================
-- GAP 3: CLOSE-PERIOD SERIALIZATION (Advisory Locks)
-- ============================================================

-- 1. Audit trail of every close/reopen attempt
CREATE TABLE IF NOT EXISTS public.period_close_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month date NOT NULL,
  operation text NOT NULL CHECK (operation IN ('close','reopen')),
  locked_by uuid NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  duration_ms int,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','succeeded','failed','timeout')),
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_period_locks_month ON public.period_close_locks(period_month, locked_at DESC);
CREATE INDEX IF NOT EXISTS idx_period_locks_active ON public.period_close_locks(status) WHERE status='active';

ALTER TABLE public.period_close_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_view_period_locks"
  ON public.period_close_locks FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Helper: acquire period operation lock with diagnostics
CREATE OR REPLACE FUNCTION public.acquire_period_operation_lock(
  p_period_month date,
  p_operation text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_key bigint;
  v_global_key constant bigint := 99999;
  v_acquired boolean;
  v_global_acquired boolean;
  v_active_lock record;
  v_lock_id uuid;
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  v_lock_key := hashtext('period_op_' || p_period_month::text);

  -- Try acquire global system-wide lock first (close vs reopen mutex)
  v_global_acquired := pg_try_advisory_xact_lock(v_global_key);
  IF NOT v_global_acquired THEN
    SELECT * INTO v_active_lock
      FROM public.period_close_locks
      WHERE status='active'
      ORDER BY locked_at DESC LIMIT 1;
    RAISE EXCEPTION 'PERIOD_OPERATION_IN_PROGRESS: A period operation is already running (since %) by user %',
      v_active_lock.locked_at, v_active_lock.locked_by;
  END IF;

  -- Per-period lock
  v_acquired := pg_try_advisory_xact_lock(v_lock_key);
  IF NOT v_acquired THEN
    SELECT * INTO v_active_lock
      FROM public.period_close_locks
      WHERE period_month = p_period_month AND status='active'
      ORDER BY locked_at DESC LIMIT 1;
    RAISE EXCEPTION 'PERIOD_LOCKED: Period % is being processed by user % since %',
      p_period_month, v_active_lock.locked_by, v_active_lock.locked_at;
  END IF;

  -- Lock the row in financial_periods (NOWAIT — fail fast)
  BEGIN
    PERFORM 1 FROM public.financial_periods
      WHERE period_month = p_period_month FOR UPDATE NOWAIT;
  EXCEPTION WHEN lock_not_available THEN
    RAISE EXCEPTION 'PERIOD_ROW_LOCKED: Period % row is locked by another transaction', p_period_month;
  END;

  -- Insert audit row
  INSERT INTO public.period_close_locks(period_month, operation, locked_by, status)
  VALUES (p_period_month, p_operation, v_caller, 'active')
  RETURNING id INTO v_lock_id;

  RETURN v_lock_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_period_operation_lock(date, text) TO authenticated;

-- 3. Helper: mark lock as released
CREATE OR REPLACE FUNCTION public.release_period_operation_lock(
  p_lock_id uuid,
  p_status text,
  p_error text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.period_close_locks
     SET released_at = now(),
         duration_ms = (EXTRACT(EPOCH FROM (now() - locked_at)) * 1000)::int,
         status = p_status,
         error_message = p_error
   WHERE id = p_lock_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_period_operation_lock(uuid, text, text) TO authenticated;

-- 4. Wrap close_period_v2 with serialization
-- We add a thin wrapper that acquires the lock then calls the original logic.
-- To avoid overwriting close_period_v2's body (which we don't want to risk regressing),
-- we add a serialized version close_period_v2_serialized and have the existing
-- close_period_v2 inherit the lock by re-creating it as a wrapper.

-- First, rename the original implementation if not already wrapped
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='close_period_v2'
      AND p.prosrc !~ 'acquire_period_operation_lock'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.close_period_v2(date, text) RENAME TO close_period_v2_inner';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- already renamed or doesn't exist — ignore
  NULL;
END $$;

CREATE OR REPLACE FUNCTION public.close_period_v2(
  p_period_month date,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_id uuid;
  v_result jsonb;
BEGIN
  -- Acquire serialization lock (raises clear error if busy)
  v_lock_id := public.acquire_period_operation_lock(p_period_month, 'close');

  BEGIN
    -- Delegate to inner implementation
    v_result := public.close_period_v2_inner(p_period_month, p_notes);
    PERFORM public.release_period_operation_lock(v_lock_id, 'succeeded', NULL);
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.release_period_operation_lock(v_lock_id, 'failed', SQLERRM);
    RAISE;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_period_v2(date, text) TO authenticated;

-- 5. Same wrapping for reopen_period
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='reopen_period'
      AND p.prosrc !~ 'acquire_period_operation_lock'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.reopen_period(date, text) RENAME TO reopen_period_inner';
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE OR REPLACE FUNCTION public.reopen_period(
  p_period_month date,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_id uuid;
  v_result jsonb;
BEGIN
  v_lock_id := public.acquire_period_operation_lock(p_period_month, 'reopen');

  BEGIN
    v_result := public.reopen_period_inner(p_period_month, p_reason);
    PERFORM public.release_period_operation_lock(v_lock_id, 'succeeded', NULL);
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.release_period_operation_lock(v_lock_id, 'failed', SQLERRM);
    RAISE;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reopen_period(date, text) TO authenticated;