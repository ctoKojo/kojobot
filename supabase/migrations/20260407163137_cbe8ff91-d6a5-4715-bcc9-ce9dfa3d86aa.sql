
-- P0: Create RPC for atomic payment recording to prevent double payments
CREATE OR REPLACE FUNCTION public.record_payment_atomic(
  p_subscription_id uuid,
  p_student_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_payment_date date,
  p_payment_type text DEFAULT 'regular',
  p_notes text DEFAULT NULL,
  p_recorded_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_new_paid numeric;
  v_new_remaining numeric;
  v_next_payment_date date;
  v_installments_covered int;
BEGIN
  -- Lock the subscription row to prevent concurrent updates
  SELECT * INTO v_sub FROM subscriptions WHERE id = p_subscription_id FOR UPDATE;
  
  IF v_sub IS NULL THEN
    RETURN jsonb_build_object('error', 'Subscription not found');
  END IF;

  -- Insert payment
  INSERT INTO payments (subscription_id, student_id, amount, payment_method, payment_date, payment_type, notes, recorded_by)
  VALUES (p_subscription_id, p_student_id, p_amount, p_payment_method, p_payment_date, p_payment_type, p_notes, p_recorded_by);

  -- Atomically compute new paid amount from actual payments sum
  SELECT COALESCE(SUM(amount), 0) INTO v_new_paid FROM payments WHERE subscription_id = p_subscription_id;
  v_new_remaining := GREATEST(0, v_sub.total_amount - v_new_paid);

  -- Compute next_payment_date advancement
  v_next_payment_date := v_sub.next_payment_date;
  IF v_sub.installment_amount IS NOT NULL AND v_sub.installment_amount > 0 THEN
    v_installments_covered := FLOOR(p_amount / v_sub.installment_amount);
    IF v_installments_covered >= 1 AND v_sub.next_payment_date IS NOT NULL THEN
      v_next_payment_date := v_sub.next_payment_date + (v_installments_covered * 30 * INTERVAL '1 day');
    END IF;
  END IF;
  IF v_new_remaining <= 0 THEN
    v_next_payment_date := NULL;
  END IF;

  -- Update subscription atomically
  UPDATE subscriptions SET
    paid_amount = v_new_paid,
    next_payment_date = v_next_payment_date,
    is_suspended = false
  WHERE id = p_subscription_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_paid', v_new_paid,
    'new_remaining', v_new_remaining,
    'next_payment_date', v_next_payment_date,
    'was_suspended', v_sub.is_suspended
  );
END;
$$;

-- P1: Trigger to deactivate instructor warnings when session is cancelled
CREATE OR REPLACE FUNCTION public.deactivate_warnings_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    UPDATE instructor_warnings
    SET is_active = false
    WHERE session_id = NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deactivate_warnings_on_cancel ON sessions;
CREATE TRIGGER trg_deactivate_warnings_on_cancel
  AFTER UPDATE ON sessions
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
  EXECUTE FUNCTION public.deactivate_warnings_on_cancel();
