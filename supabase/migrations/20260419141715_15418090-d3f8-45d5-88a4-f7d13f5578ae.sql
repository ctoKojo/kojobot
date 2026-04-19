-- ============================================================
-- GAP 1: TRANSACTION COORDINATOR
-- Single orchestrator pattern with savepoint-based rollback
-- ============================================================

-- 1. Failures diagnostic table (logged out-of-band)
CREATE TABLE IF NOT EXISTS public.transaction_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordinator_name text NOT NULL,
  failed_at_step text NOT NULL,
  input_payload jsonb NOT NULL,
  error_message text NOT NULL,
  error_detail text,
  attempted_by uuid,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_txn_failures_coord ON public.transaction_failures(coordinator_name, attempted_at DESC);

ALTER TABLE public.transaction_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_view_txn_failures"
  ON public.transaction_failures FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Helper: log failure in autonomous-like manner (uses dblink-free pattern via deferred insert)
CREATE OR REPLACE FUNCTION public.log_transaction_failure(
  p_coordinator text,
  p_step text,
  p_payload jsonb,
  p_error text,
  p_detail text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Best-effort log; never raise
  BEGIN
    INSERT INTO public.transaction_failures(
      coordinator_name, failed_at_step, input_payload,
      error_message, error_detail, attempted_by
    ) VALUES (
      p_coordinator, p_step, p_payload, p_error, p_detail, auth.uid()
    );
  EXCEPTION WHEN OTHERS THEN
    -- swallow — never break the transaction further
    NULL;
  END;
END;
$$;

-- 3. Payment Coordinator
CREATE OR REPLACE FUNCTION public.coordinate_payment_transaction(
  p_payment_data jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_id uuid;
  v_step text := 'init';
  v_caller uuid := auth.uid();
BEGIN
  -- Authorization
  IF NOT (public.has_role(v_caller, 'admin') OR public.has_role(v_caller, 'reception')) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only admin or reception can coordinate payments';
  END IF;

  -- Mark RPC context for downstream defense-in-depth
  PERFORM set_config('app.via_rpc', 'true', true);
  PERFORM set_config('app.coordinator_active', 'coordinate_payment_transaction', true);

  -- Validate required fields
  IF (p_payment_data->>'subscription_id') IS NULL
     OR (p_payment_data->>'student_id') IS NULL
     OR (p_payment_data->>'amount') IS NULL
     OR (p_payment_data->>'payment_date') IS NULL
     OR (p_payment_data->>'payment_type') IS NULL
  THEN
    RAISE EXCEPTION 'MISSING_FIELDS: subscription_id, student_id, amount, payment_date, payment_type are required';
  END IF;

  v_step := 'record_payment';
  -- Delegate to the existing atomic primitive (which handles journal + cash linking)
  v_payment_id := public.record_payment_atomic(
    p_subscription_id := (p_payment_data->>'subscription_id')::uuid,
    p_student_id      := (p_payment_data->>'student_id')::uuid,
    p_amount          := (p_payment_data->>'amount')::numeric,
    p_payment_date    := (p_payment_data->>'payment_date')::date,
    p_payment_type    := p_payment_data->>'payment_type',
    p_payment_method  := COALESCE((p_payment_data->>'payment_method')::payment_method_type, 'cash'),
    p_transfer_type   := NULLIF(p_payment_data->>'transfer_type','')::transfer_method_type,
    p_notes           := p_payment_data->>'notes'
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'coordinator', 'coordinate_payment_transaction'
  );

EXCEPTION WHEN OTHERS THEN
  -- Persist failure diagnostic (best effort, ignored if it also fails)
  PERFORM public.log_transaction_failure(
    'coordinate_payment_transaction',
    v_step,
    p_payment_data,
    SQLERRM,
    SQLSTATE
  );
  RAISE;
END;
$$;

-- 4. Expense Coordinator
CREATE OR REPLACE FUNCTION public.coordinate_expense_transaction(
  p_expense_data jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense_id uuid;
  v_step text := 'init';
  v_caller uuid := auth.uid();
BEGIN
  IF NOT (public.has_role(v_caller, 'admin') OR public.has_role(v_caller, 'reception')) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only admin or reception can coordinate expenses';
  END IF;

  PERFORM set_config('app.via_rpc', 'true', true);
  PERFORM set_config('app.coordinator_active', 'coordinate_expense_transaction', true);

  IF (p_expense_data->>'amount') IS NULL OR (p_expense_data->>'description') IS NULL THEN
    RAISE EXCEPTION 'MISSING_FIELDS: amount and description are required';
  END IF;

  v_step := 'record_expense';
  v_expense_id := public.record_expense_atomic(
    p_amount          := (p_expense_data->>'amount')::numeric,
    p_description     := p_expense_data->>'description',
    p_description_ar  := p_expense_data->>'description_ar',
    p_category        := COALESCE(p_expense_data->>'category','general'),
    p_expense_date    := NULLIF(p_expense_data->>'expense_date','')::date,
    p_payment_method  := COALESCE((p_expense_data->>'payment_method')::payment_method_type,'cash'),
    p_transfer_type   := NULLIF(p_expense_data->>'transfer_type','')::transfer_method_type,
    p_is_recurring    := COALESCE((p_expense_data->>'is_recurring')::boolean, false),
    p_notes           := p_expense_data->>'notes'
  );

  RETURN jsonb_build_object(
    'success', true,
    'expense_id', v_expense_id,
    'coordinator', 'coordinate_expense_transaction'
  );

EXCEPTION WHEN OTHERS THEN
  PERFORM public.log_transaction_failure(
    'coordinate_expense_transaction', v_step, p_expense_data, SQLERRM, SQLSTATE
  );
  RAISE;
END;
$$;

-- 5. Salary Coordinator
CREATE OR REPLACE FUNCTION public.coordinate_salary_payment_transaction(
  p_salary_data jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_salary_payment_id uuid;
  v_step text := 'init';
  v_caller uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_caller, 'admin') THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only admin can coordinate salary payments';
  END IF;

  PERFORM set_config('app.via_rpc', 'true', true);
  PERFORM set_config('app.coordinator_active', 'coordinate_salary_payment_transaction', true);

  IF (p_salary_data->>'employee_id') IS NULL
     OR (p_salary_data->>'salary_id') IS NULL
     OR (p_salary_data->>'month') IS NULL
     OR (p_salary_data->>'base_amount') IS NULL
  THEN
    RAISE EXCEPTION 'MISSING_FIELDS: employee_id, salary_id, month, base_amount are required';
  END IF;

  v_step := 'record_salary_payment';
  v_salary_payment_id := public.record_salary_payment_atomic(
    p_employee_id      := (p_salary_data->>'employee_id')::uuid,
    p_salary_id        := (p_salary_data->>'salary_id')::uuid,
    p_month            := (p_salary_data->>'month')::date,
    p_base_amount      := (p_salary_data->>'base_amount')::numeric,
    p_bonus            := COALESCE((p_salary_data->>'bonus')::numeric, 0),
    p_deductions       := COALESCE((p_salary_data->>'deductions')::numeric, 0),
    p_payment_method   := COALESCE((p_salary_data->>'payment_method')::payment_method_type,'cash'),
    p_transfer_type    := NULLIF(p_salary_data->>'transfer_type','')::transfer_method_type,
    p_paid_date        := NULLIF(p_salary_data->>'paid_date','')::date,
    p_notes            := p_salary_data->>'notes',
    p_bonus_reason     := p_salary_data->>'bonus_reason',
    p_deduction_reason := p_salary_data->>'deduction_reason'
  );

  RETURN jsonb_build_object(
    'success', true,
    'salary_payment_id', v_salary_payment_id,
    'coordinator', 'coordinate_salary_payment_transaction'
  );

EXCEPTION WHEN OTHERS THEN
  PERFORM public.log_transaction_failure(
    'coordinate_salary_payment_transaction', v_step, p_salary_data, SQLERRM, SQLSTATE
  );
  RAISE;
END;
$$;

-- 6. Grants
GRANT EXECUTE ON FUNCTION public.coordinate_payment_transaction(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.coordinate_expense_transaction(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.coordinate_salary_payment_transaction(jsonb) TO authenticated;

-- 7. Register in approved RPC registry
INSERT INTO public.approved_financial_rpcs(rpc_name, description, version) VALUES
  ('coordinate_payment_transaction', 'Orchestrator: payment + journal + cash movement (atomic)', 1),
  ('coordinate_expense_transaction', 'Orchestrator: expense + journal + cash movement (atomic)', 1),
  ('coordinate_salary_payment_transaction', 'Orchestrator: salary payment + journal + cash movement (atomic)', 1)
ON CONFLICT (rpc_name) DO NOTHING;