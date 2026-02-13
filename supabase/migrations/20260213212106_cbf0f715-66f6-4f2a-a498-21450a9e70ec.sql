
-- 1. Allow NULL start_date and end_date on subscriptions
ALTER TABLE public.subscriptions ALTER COLUMN start_date DROP NOT NULL;
ALTER TABLE public.subscriptions ALTER COLUMN end_date DROP NOT NULL;

-- 2. Function: assign_subscription_dates (single student)
CREATE OR REPLACE FUNCTION public.assign_subscription_dates(p_student_id UUID, p_group_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_has_started BOOLEAN;
  v_first_date DATE;
  v_sub_id UUID;
  v_payment_type TEXT;
  v_total_amount NUMERIC;
  v_paid_amount NUMERIC;
  v_installment_amount NUMERIC;
  v_paid_installments INTEGER;
  v_next_payment DATE;
BEGIN
  -- 1. Validate group is started
  SELECT has_started INTO v_has_started
  FROM public.groups
  WHERE id = p_group_id;

  IF v_has_started IS NULL THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  IF NOT v_has_started THEN
    RETURN jsonb_build_object('updated', false, 'reason', 'group_not_started');
  END IF;

  -- 2. Get first session date
  SELECT session_date INTO v_first_date
  FROM public.sessions
  WHERE group_id = p_group_id
  ORDER BY session_date ASC
  LIMIT 1;

  IF v_first_date IS NULL THEN
    RAISE EXCEPTION 'No sessions found for group %', p_group_id;
  END IF;

  -- 3. Lock the pending subscription (row locking to prevent race conditions)
  SELECT id, payment_type, total_amount, paid_amount, installment_amount
  INTO v_sub_id, v_payment_type, v_total_amount, v_paid_amount, v_installment_amount
  FROM public.subscriptions
  WHERE student_id = p_student_id
    AND status = 'active'
    AND start_date IS NULL
  FOR UPDATE;

  IF v_sub_id IS NULL THEN
    RETURN jsonb_build_object('updated', false, 'reason', 'no_pending_subscription');
  END IF;

  -- 4. Calculate next_payment_date for installment subscriptions
  v_next_payment := NULL;
  IF v_payment_type = 'installment' AND v_installment_amount IS NOT NULL AND v_installment_amount > 0 THEN
    v_paid_installments := FLOOR(v_paid_amount / v_installment_amount)::INTEGER;
    v_next_payment := v_first_date + (v_paid_installments * 30);
  END IF;

  -- 5. Update subscription with dates
  UPDATE public.subscriptions
  SET start_date = v_first_date,
      end_date = v_first_date + 90,
      next_payment_date = v_next_payment
  WHERE id = v_sub_id;

  RETURN jsonb_build_object(
    'updated', true,
    'start_date', v_first_date,
    'end_date', v_first_date + 90
  );
END;
$$;

-- 3. Function: assign_subscription_dates_bulk (all students in a group)
CREATE OR REPLACE FUNCTION public.assign_subscription_dates_bulk(p_group_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_has_started BOOLEAN;
  v_first_date DATE;
  v_updated_count INTEGER;
BEGIN
  -- 1. Validate group is started
  SELECT has_started INTO v_has_started
  FROM public.groups
  WHERE id = p_group_id;

  IF v_has_started IS NULL THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  IF NOT v_has_started THEN
    RETURN jsonb_build_object('updated', false, 'reason', 'group_not_started');
  END IF;

  -- 2. Get first session date
  SELECT session_date INTO v_first_date
  FROM public.sessions
  WHERE group_id = p_group_id
  ORDER BY session_date ASC
  LIMIT 1;

  IF v_first_date IS NULL THEN
    RAISE EXCEPTION 'No sessions found for group %', p_group_id;
  END IF;

  -- 3. Bulk update: set dates for all active students with pending subscriptions
  UPDATE public.subscriptions sub
  SET start_date = v_first_date,
      end_date = v_first_date + 90,
      next_payment_date = CASE
        WHEN sub.payment_type = 'installment'
             AND sub.installment_amount IS NOT NULL
             AND sub.installment_amount > 0
        THEN v_first_date + (FLOOR(sub.paid_amount / sub.installment_amount)::INTEGER * 30)
        ELSE NULL
      END
  FROM public.group_students gs
  WHERE gs.group_id = p_group_id
    AND gs.is_active = true
    AND sub.student_id = gs.student_id
    AND sub.status = 'active'
    AND sub.start_date IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'updated', true,
    'count', v_updated_count,
    'start_date', v_first_date,
    'end_date', v_first_date + 90
  );
END;
$$;
