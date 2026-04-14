
CREATE OR REPLACE FUNCTION public.record_payment_atomic(
  p_subscription_id uuid,
  p_student_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_payment_date date,
  p_payment_type text DEFAULT 'regular',
  p_notes text DEFAULT NULL,
  p_recorded_by uuid DEFAULT NULL
) RETURNS jsonb
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
  v_dup_count int;
  v_current_paid numeric;
BEGIN
  SELECT * INTO v_sub FROM subscriptions WHERE id = p_subscription_id FOR UPDATE;
  
  IF v_sub IS NULL THEN
    RETURN jsonb_build_object('error', 'Subscription not found');
  END IF;

  -- Deduplication guard: reject if same amount recorded in last 2 minutes
  SELECT COUNT(*) INTO v_dup_count
  FROM payments
  WHERE subscription_id = p_subscription_id
    AND amount = p_amount
    AND created_at > now() - interval '2 minutes';

  IF v_dup_count > 0 THEN
    RETURN jsonb_build_object('error', 'دفعة مشابهة تم تسجيلها منذ أقل من دقيقتين. يرجى الانتظار قبل المحاولة مرة أخرى.');
  END IF;

  -- Overpayment guard: reject if total paid would exceed total_amount
  SELECT COALESCE(SUM(amount), 0) INTO v_current_paid
  FROM payments
  WHERE subscription_id = p_subscription_id;

  IF v_sub.total_amount IS NOT NULL AND (v_current_paid + p_amount) > v_sub.total_amount THEN
    RETURN jsonb_build_object('error', 'المبلغ المدفوع يتجاوز إجمالي قيمة الاشتراك. الحد الأقصى المتاح: ' || (v_sub.total_amount - v_current_paid)::text || ' ج.م');
  END IF;

  INSERT INTO payments (subscription_id, student_id, amount, payment_method, payment_date, payment_type, notes, recorded_by)
  VALUES (p_subscription_id, p_student_id, p_amount, p_payment_method, p_payment_date, p_payment_type, p_notes, p_recorded_by);

  SELECT COALESCE(SUM(amount), 0) INTO v_new_paid FROM payments WHERE subscription_id = p_subscription_id;
  v_new_remaining := GREATEST(0, v_sub.total_amount - v_new_paid);

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
