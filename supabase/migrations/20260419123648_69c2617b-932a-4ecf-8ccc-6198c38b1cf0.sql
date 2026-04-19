
-- ============================================================
-- Approved Financial RPCs (centralized writes)
-- ============================================================

-- 1) record_payment_atomic
CREATE OR REPLACE FUNCTION public.record_payment_atomic(
  p_subscription_id uuid,
  p_student_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_type text,
  p_payment_method public.payment_method_type DEFAULT 'cash',
  p_transfer_type public.transfer_method_type DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_payment_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF NOT (public.has_role(v_user, 'admin') OR public.has_role(v_user, 'reception')) THEN
    RAISE EXCEPTION 'FORBIDDEN: only admin/reception can record payments' USING ERRCODE = '42501';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: amount must be > 0' USING ERRCODE = '23514';
  END IF;

  -- mark session for the trigger guard
  PERFORM set_config('app.via_rpc', 'true', true);

  INSERT INTO public.payments (
    subscription_id, student_id, amount, payment_date, payment_type,
    payment_method, transfer_type, notes, recorded_by
  ) VALUES (
    p_subscription_id, p_student_id, p_amount, COALESCE(p_payment_date, CURRENT_DATE),
    p_payment_type, p_payment_method, p_transfer_type, p_notes, v_user
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_payment_atomic(uuid, uuid, numeric, date, text, public.payment_method_type, public.transfer_method_type, text) TO authenticated;
SELECT public.register_financial_rpc('record_payment_atomic', 1, 'Records a payment for a subscription. Supports cash + transfer.');

-- 2) record_expense_atomic
CREATE OR REPLACE FUNCTION public.record_expense_atomic(
  p_amount numeric,
  p_description text,
  p_description_ar text DEFAULT NULL,
  p_category text DEFAULT 'general',
  p_expense_date date DEFAULT NULL,
  p_payment_method public.payment_method_type DEFAULT 'cash',
  p_transfer_type public.transfer_method_type DEFAULT NULL,
  p_is_recurring boolean DEFAULT false,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_expense_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF NOT (public.has_role(v_user, 'admin') OR public.has_role(v_user, 'reception')) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT' USING ERRCODE = '23514';
  END IF;

  PERFORM set_config('app.via_rpc', 'true', true);

  INSERT INTO public.expenses (
    amount, description, description_ar, category,
    expense_date, payment_method, transfer_type,
    is_recurring, notes, recorded_by
  ) VALUES (
    p_amount, p_description, p_description_ar, p_category,
    COALESCE(p_expense_date, CURRENT_DATE), p_payment_method, p_transfer_type,
    p_is_recurring, p_notes, v_user
  )
  RETURNING id INTO v_expense_id;

  RETURN v_expense_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_expense_atomic(numeric, text, text, text, date, public.payment_method_type, public.transfer_method_type, boolean, text) TO authenticated;
SELECT public.register_financial_rpc('record_expense_atomic', 1, 'Records an operational expense. Supports cash + transfer.');

-- 3) record_salary_payment_atomic (only if salary_payments exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'salary_payments') THEN

    EXECUTE $func$
    CREATE OR REPLACE FUNCTION public.record_salary_payment_atomic(
      p_employee_id uuid,
      p_salary_id uuid,
      p_month date,
      p_base_amount numeric,
      p_bonus numeric DEFAULT 0,
      p_deductions numeric DEFAULT 0,
      p_payment_method public.payment_method_type DEFAULT 'cash',
      p_transfer_type public.transfer_method_type DEFAULT NULL,
      p_paid_date date DEFAULT NULL,
      p_notes text DEFAULT NULL,
      p_bonus_reason text DEFAULT NULL,
      p_deduction_reason text DEFAULT NULL
    )
    RETURNS uuid
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $body$
    DECLARE
      v_user uuid := auth.uid();
      v_id uuid;
      v_net numeric;
    BEGIN
      IF v_user IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
      END IF;

      IF NOT public.has_role(v_user, 'admin') THEN
        RAISE EXCEPTION 'FORBIDDEN: only admins can pay salaries' USING ERRCODE = '42501';
      END IF;

      v_net := p_base_amount + COALESCE(p_bonus, 0) - COALESCE(p_deductions, 0);

      PERFORM set_config('app.via_rpc', 'true', true);

      INSERT INTO public.salary_payments (
        employee_id, salary_id, month, base_amount,
        bonus, deductions, net_amount,
        payment_method, transfer_type,
        paid_date, paid_by, status, notes,
        bonus_reason, deduction_reason
      ) VALUES (
        p_employee_id, p_salary_id, date_trunc('month', p_month)::date, p_base_amount,
        COALESCE(p_bonus, 0), COALESCE(p_deductions, 0), v_net,
        p_payment_method, p_transfer_type,
        COALESCE(p_paid_date, CURRENT_DATE), v_user, 'paid', p_notes,
        p_bonus_reason, p_deduction_reason
      )
      RETURNING id INTO v_id;

      RETURN v_id;
    END;
    $body$;
    $func$;

    EXECUTE 'GRANT EXECUTE ON FUNCTION public.record_salary_payment_atomic(uuid, uuid, date, numeric, numeric, numeric, public.payment_method_type, public.transfer_method_type, date, text, text, text) TO authenticated';

    PERFORM public.register_financial_rpc('record_salary_payment_atomic', 1, 'Records a salary payment for an employee.');
  END IF;
END $$;

-- 4) attach_payment_receipt
CREATE OR REPLACE FUNCTION public.attach_payment_receipt(
  p_payment_id uuid,
  p_receipt_path text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_method public.payment_method_type;
  v_recorded_by uuid;
  v_expected_prefix text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF NOT (public.has_role(v_user, 'admin') OR public.has_role(v_user, 'reception')) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT payment_method, recorded_by INTO v_method, v_recorded_by
  FROM public.payments WHERE id = p_payment_id;

  IF v_method IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_method <> 'transfer' THEN
    RAISE EXCEPTION 'RECEIPT_NOT_ALLOWED: payment is not a transfer' USING ERRCODE = '23514';
  END IF;

  v_expected_prefix := 'payments/' || p_payment_id::text || '/';
  IF position(v_expected_prefix in p_receipt_path) <> 1 THEN
    RAISE EXCEPTION 'INVALID_PATH: receipt path must start with %', v_expected_prefix USING ERRCODE = '23514';
  END IF;

  -- verify file exists in bucket
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id = 'payment-receipts' AND name = p_receipt_path
  ) THEN
    RAISE EXCEPTION 'FILE_NOT_FOUND: % not in storage', p_receipt_path USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('app.via_rpc', 'true', true);

  UPDATE public.payments
  SET receipt_url = p_receipt_path,
      receipt_status = 'completed'
  WHERE id = p_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.attach_payment_receipt(uuid, text) TO authenticated;
SELECT public.register_financial_rpc('attach_payment_receipt', 1, 'Attaches an uploaded receipt to a payment.');

-- 5) attach_expense_receipt
CREATE OR REPLACE FUNCTION public.attach_expense_receipt(
  p_expense_id uuid,
  p_receipt_path text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_method public.payment_method_type;
  v_expected_prefix text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF NOT (public.has_role(v_user, 'admin') OR public.has_role(v_user, 'reception')) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT payment_method INTO v_method FROM public.expenses WHERE id = p_expense_id;

  IF v_method IS NULL THEN
    RAISE EXCEPTION 'EXPENSE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_method <> 'transfer' THEN
    RAISE EXCEPTION 'RECEIPT_NOT_ALLOWED' USING ERRCODE = '23514';
  END IF;

  v_expected_prefix := 'expenses/' || p_expense_id::text || '/';
  IF position(v_expected_prefix in p_receipt_path) <> 1 THEN
    RAISE EXCEPTION 'INVALID_PATH: must start with %', v_expected_prefix USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id = 'payment-receipts' AND name = p_receipt_path
  ) THEN
    RAISE EXCEPTION 'FILE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('app.via_rpc', 'true', true);

  UPDATE public.expenses
  SET receipt_url = p_receipt_path,
      receipt_status = 'completed'
  WHERE id = p_expense_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.attach_expense_receipt(uuid, text) TO authenticated;
SELECT public.register_financial_rpc('attach_expense_receipt', 1, 'Attaches a receipt to an expense.');

-- 6) attach_salary_receipt (if salary_payments exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'salary_payments') THEN
    EXECUTE $func$
    CREATE OR REPLACE FUNCTION public.attach_salary_receipt(
      p_salary_payment_id uuid,
      p_receipt_path text
    )
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $body$
    DECLARE
      v_user uuid := auth.uid();
      v_method public.payment_method_type;
      v_expected_prefix text;
    BEGIN
      IF v_user IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
      END IF;

      IF NOT public.has_role(v_user, 'admin') THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
      END IF;

      SELECT payment_method INTO v_method FROM public.salary_payments WHERE id = p_salary_payment_id;

      IF v_method IS NULL THEN
        RAISE EXCEPTION 'SALARY_PAYMENT_NOT_FOUND' USING ERRCODE = 'P0002';
      END IF;

      IF v_method <> 'transfer' THEN
        RAISE EXCEPTION 'RECEIPT_NOT_ALLOWED' USING ERRCODE = '23514';
      END IF;

      v_expected_prefix := 'salaries/' || p_salary_payment_id::text || '/';
      IF position(v_expected_prefix in p_receipt_path) <> 1 THEN
        RAISE EXCEPTION 'INVALID_PATH' USING ERRCODE = '23514';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM storage.objects
        WHERE bucket_id = 'payment-receipts' AND name = p_receipt_path
      ) THEN
        RAISE EXCEPTION 'FILE_NOT_FOUND' USING ERRCODE = 'P0002';
      END IF;

      PERFORM set_config('app.via_rpc', 'true', true);

      UPDATE public.salary_payments
      SET receipt_url = p_receipt_path,
          receipt_status = 'completed'
      WHERE id = p_salary_payment_id;
    END;
    $body$;
    $func$;

    EXECUTE 'GRANT EXECUTE ON FUNCTION public.attach_salary_receipt(uuid, text) TO authenticated';
    PERFORM public.register_financial_rpc('attach_salary_receipt', 1, 'Attaches a receipt to a salary payment.');
  END IF;
END $$;
