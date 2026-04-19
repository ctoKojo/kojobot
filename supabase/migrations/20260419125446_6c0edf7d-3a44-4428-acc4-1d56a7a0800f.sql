
-- ============================================================
-- PHASE 3: PAYROLL SYSTEM
-- ============================================================

-- ENUMs
CREATE TYPE public.payroll_run_status AS ENUM (
  'draft', 'review', 'approved', 'paid', 'cancelled'
);

CREATE TYPE public.payroll_adjustment_type AS ENUM (
  'bonus', 'deduction', 'correction', 'reimbursement'
);

CREATE TYPE public.payroll_employee_group AS ENUM (
  'instructor', 'reception', 'all'
);

-- ============================================================
-- TABLE: payroll_runs
-- ============================================================
CREATE TABLE public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month date NOT NULL,
  employee_group public.payroll_employee_group NOT NULL DEFAULT 'all',
  status public.payroll_run_status NOT NULL DEFAULT 'draft',
  total_gross numeric(12,2) NOT NULL DEFAULT 0,
  total_deductions numeric(12,2) NOT NULL DEFAULT 0,
  total_bonuses numeric(12,2) NOT NULL DEFAULT 0,
  total_net numeric(12,2) NOT NULL DEFAULT 0,
  employee_count integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_runs_period_month_first_day CHECK (date_trunc('month', period_month) = period_month),
  CONSTRAINT payroll_runs_unique_month_group UNIQUE (period_month, employee_group)
);

CREATE INDEX idx_payroll_runs_period ON public.payroll_runs(period_month DESC);
CREATE INDEX idx_payroll_runs_status ON public.payroll_runs(status);

-- ============================================================
-- TABLE: payroll_run_lines
-- ============================================================
CREATE TABLE public.payroll_run_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL,
  employee_type text NOT NULL,
  base_salary numeric(12,2) NOT NULL,
  total_deductions numeric(12,2) NOT NULL DEFAULT 0,
  total_bonuses numeric(12,2) NOT NULL DEFAULT 0,
  net_amount numeric(12,2) NOT NULL,
  salary_payment_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_run_lines_unique_employee UNIQUE (payroll_run_id, employee_id)
);

CREATE INDEX idx_payroll_run_lines_run ON public.payroll_run_lines(payroll_run_id);
CREATE INDEX idx_payroll_run_lines_employee ON public.payroll_run_lines(employee_id);

-- ============================================================
-- TABLE: payroll_adjustments
-- ============================================================
CREATE TABLE public.payroll_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid REFERENCES public.payroll_runs(id) ON DELETE SET NULL,
  payroll_run_line_id uuid REFERENCES public.payroll_run_lines(id) ON DELETE SET NULL,
  employee_id uuid NOT NULL,
  adjustment_type public.payroll_adjustment_type NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  reason_ar text,
  applied_in_period date NOT NULL,
  created_by uuid NOT NULL,
  approved_by uuid,
  approved_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payroll_adjustments_employee ON public.payroll_adjustments(employee_id);
CREATE INDEX idx_payroll_adjustments_period ON public.payroll_adjustments(applied_in_period);
CREATE INDEX idx_payroll_adjustments_status ON public.payroll_adjustments(status);

-- ============================================================
-- ENABLE RLS
-- ============================================================
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_run_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RPC ENFORCEMENT TRIGGERS
-- ============================================================
CREATE TRIGGER enforce_via_rpc_payroll_runs
  BEFORE INSERT OR UPDATE OR DELETE ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_via_rpc();

CREATE TRIGGER enforce_via_rpc_payroll_run_lines
  BEFORE INSERT OR UPDATE OR DELETE ON public.payroll_run_lines
  FOR EACH ROW EXECUTE FUNCTION public.enforce_via_rpc();

CREATE TRIGGER enforce_via_rpc_payroll_adjustments
  BEFORE INSERT OR UPDATE OR DELETE ON public.payroll_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_via_rpc();

-- ============================================================
-- RLS POLICIES (read-only for clients; writes go through RPCs)
-- ============================================================

-- payroll_runs: admin/reception view all; employees view via own lines
CREATE POLICY "Admin and reception view payroll runs"
  ON public.payroll_runs FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'reception'::public.app_role)
  );

-- Block direct DML
CREATE POLICY "no_direct_dml_payroll_runs"
  ON public.payroll_runs FOR ALL
  USING (false) WITH CHECK (false);

-- payroll_run_lines: admin/reception view all; employees view own
CREATE POLICY "Admin and reception view payroll lines"
  ON public.payroll_run_lines FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'reception'::public.app_role)
  );

CREATE POLICY "Employees view own payroll lines"
  ON public.payroll_run_lines FOR SELECT
  USING (employee_id = auth.uid());

CREATE POLICY "no_direct_dml_payroll_run_lines"
  ON public.payroll_run_lines FOR ALL
  USING (false) WITH CHECK (false);

-- payroll_adjustments: admin/reception manage; employees view own
CREATE POLICY "Admin and reception view payroll adjustments"
  ON public.payroll_adjustments FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'reception'::public.app_role)
  );

CREATE POLICY "Employees view own payroll adjustments"
  ON public.payroll_adjustments FOR SELECT
  USING (employee_id = auth.uid());

CREATE POLICY "no_direct_dml_payroll_adjustments"
  ON public.payroll_adjustments FOR ALL
  USING (false) WITH CHECK (false);

-- ============================================================
-- updated_at trigger
-- ============================================================
CREATE TRIGGER update_payroll_runs_updated_at
  BEFORE UPDATE ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RPC: create_payroll_run (draft)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_payroll_run(
  p_period_month date,
  p_employee_group public.payroll_employee_group DEFAULT 'all'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_run_id uuid;
  v_period_first date := date_trunc('month', p_period_month)::date;
  v_employee_count integer := 0;
  v_total_gross numeric := 0;
  v_total_net numeric := 0;
  v_emp record;
  v_base_salary numeric;
  v_adjustments_bonus numeric;
  v_adjustments_deduction numeric;
  v_line_net numeric;
BEGIN
  IF NOT public.has_role(v_user_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can create payroll runs';
  END IF;

  -- Period must be open
  IF EXISTS (
    SELECT 1 FROM public.financial_periods
    WHERE period_month = v_period_first
      AND status IN ('closed', 'review')
  ) THEN
    RAISE EXCEPTION 'Cannot create payroll run for a closed or review period';
  END IF;

  -- Mark RPC context
  PERFORM set_config('app.via_rpc', 'true', true);

  -- Insert draft run
  INSERT INTO public.payroll_runs (
    period_month, employee_group, status, created_by
  ) VALUES (
    v_period_first, p_employee_group, 'draft', v_user_id
  )
  RETURNING id INTO v_run_id;

  -- Build lines from active employees + active salaries + period adjustments
  FOR v_emp IN
    SELECT es.employee_id, es.employee_type, es.base_salary
    FROM public.employee_salaries es
    WHERE es.is_active = true
      AND es.effective_from <= (v_period_first + interval '1 month - 1 day')::date
      AND (
        p_employee_group = 'all'
        OR (p_employee_group = 'instructor' AND es.employee_type = 'instructor')
        OR (p_employee_group = 'reception' AND es.employee_type = 'reception')
      )
  LOOP
    v_base_salary := v_emp.base_salary;

    SELECT COALESCE(SUM(amount), 0) INTO v_adjustments_bonus
    FROM public.payroll_adjustments
    WHERE employee_id = v_emp.employee_id
      AND applied_in_period = v_period_first
      AND status = 'approved'
      AND adjustment_type IN ('bonus', 'reimbursement');

    SELECT COALESCE(SUM(amount), 0) INTO v_adjustments_deduction
    FROM public.payroll_adjustments
    WHERE employee_id = v_emp.employee_id
      AND applied_in_period = v_period_first
      AND status = 'approved'
      AND adjustment_type IN ('deduction', 'correction');

    v_line_net := v_base_salary + v_adjustments_bonus - v_adjustments_deduction;

    INSERT INTO public.payroll_run_lines (
      payroll_run_id, employee_id, employee_type,
      base_salary, total_bonuses, total_deductions, net_amount
    ) VALUES (
      v_run_id, v_emp.employee_id, v_emp.employee_type,
      v_base_salary, v_adjustments_bonus, v_adjustments_deduction, v_line_net
    );

    v_employee_count := v_employee_count + 1;
    v_total_gross := v_total_gross + v_base_salary + v_adjustments_bonus;
    v_total_net := v_total_net + v_line_net;
  END LOOP;

  -- Update totals
  UPDATE public.payroll_runs
  SET employee_count = v_employee_count,
      total_gross = v_total_gross,
      total_net = v_total_net,
      total_deductions = (SELECT COALESCE(SUM(total_deductions),0) FROM public.payroll_run_lines WHERE payroll_run_id = v_run_id),
      total_bonuses = (SELECT COALESCE(SUM(total_bonuses),0) FROM public.payroll_run_lines WHERE payroll_run_id = v_run_id),
      updated_at = now()
  WHERE id = v_run_id;

  RETURN v_run_id;
END;
$$;

-- ============================================================
-- RPC: submit_payroll_run_for_review
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_payroll_run_for_review(p_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_status public.payroll_run_status;
BEGIN
  IF NOT public.has_role(v_user_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can submit payroll for review';
  END IF;

  SELECT status INTO v_status FROM public.payroll_runs WHERE id = p_run_id FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Payroll run not found';
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft payroll runs can be submitted for review (current: %)', v_status;
  END IF;

  PERFORM set_config('app.via_rpc', 'true', true);

  UPDATE public.payroll_runs
  SET status = 'review',
      reviewed_by = v_user_id,
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_run_id;
END;
$$;

-- ============================================================
-- RPC: approve_payroll_run (segregation: different user)
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_payroll_run(p_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_run record;
BEGIN
  IF NOT public.has_role(v_user_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can approve payroll runs';
  END IF;

  SELECT * INTO v_run FROM public.payroll_runs WHERE id = p_run_id FOR UPDATE;
  IF v_run IS NULL THEN
    RAISE EXCEPTION 'Payroll run not found';
  END IF;
  IF v_run.status <> 'review' THEN
    RAISE EXCEPTION 'Only payroll runs in review can be approved (current: %)', v_run.status;
  END IF;

  -- Segregation of duties: approver must differ from reviewer
  IF v_run.reviewed_by = v_user_id THEN
    RAISE EXCEPTION 'Segregation of duties: the approver must differ from the reviewer';
  END IF;

  -- Period must still be open
  IF EXISTS (
    SELECT 1 FROM public.financial_periods
    WHERE period_month = v_run.period_month
      AND status IN ('closed', 'review')
  ) THEN
    RAISE EXCEPTION 'Cannot approve payroll for a closed or review period';
  END IF;

  PERFORM set_config('app.via_rpc', 'true', true);

  UPDATE public.payroll_runs
  SET status = 'approved',
      approved_by = v_user_id,
      approved_at = now(),
      updated_at = now()
  WHERE id = p_run_id;
END;
$$;

-- ============================================================
-- RPC: pay_payroll_run (creates salary_payments + auto-posts journals)
-- ============================================================
CREATE OR REPLACE FUNCTION public.pay_payroll_run(
  p_run_id uuid,
  p_payment_method public.payment_method_type DEFAULT 'cash',
  p_transfer_type public.transfer_method_type DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_run record;
  v_line record;
  v_payment_id uuid;
  v_paid_count integer := 0;
BEGIN
  IF NOT public.has_role(v_user_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can pay payroll runs';
  END IF;

  SELECT * INTO v_run FROM public.payroll_runs WHERE id = p_run_id FOR UPDATE;
  IF v_run IS NULL THEN
    RAISE EXCEPTION 'Payroll run not found';
  END IF;
  IF v_run.status <> 'approved' THEN
    RAISE EXCEPTION 'Only approved payroll runs can be paid (current: %)', v_run.status;
  END IF;

  -- Process each line via the approved salary payment RPC
  FOR v_line IN
    SELECT * FROM public.payroll_run_lines
    WHERE payroll_run_id = p_run_id
      AND salary_payment_id IS NULL
      AND net_amount > 0
  LOOP
    v_payment_id := public.record_salary_payment_atomic(
      p_employee_id := v_line.employee_id,
      p_amount := v_line.net_amount,
      p_period_month := v_run.period_month,
      p_payment_method := p_payment_method,
      p_transfer_type := p_transfer_type,
      p_notes := format('Payroll run %s - %s', p_run_id, v_line.employee_type)
    );

    PERFORM set_config('app.via_rpc', 'true', true);
    UPDATE public.payroll_run_lines
    SET salary_payment_id = v_payment_id
    WHERE id = v_line.id;

    v_paid_count := v_paid_count + 1;
  END LOOP;

  PERFORM set_config('app.via_rpc', 'true', true);
  UPDATE public.payroll_runs
  SET status = 'paid',
      paid_at = now(),
      updated_at = now()
  WHERE id = p_run_id;

  RETURN jsonb_build_object(
    'run_id', p_run_id,
    'paid_count', v_paid_count,
    'total_paid', v_run.total_net
  );
END;
$$;

-- ============================================================
-- RPC: cancel_payroll_run
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_payroll_run(
  p_run_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_status public.payroll_run_status;
BEGIN
  IF NOT public.has_role(v_user_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can cancel payroll runs';
  END IF;

  SELECT status INTO v_status FROM public.payroll_runs WHERE id = p_run_id FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Payroll run not found';
  END IF;
  IF v_status IN ('paid', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot cancel a payroll run that is % ', v_status;
  END IF;

  PERFORM set_config('app.via_rpc', 'true', true);
  UPDATE public.payroll_runs
  SET status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_user_id,
      cancellation_reason = p_reason,
      updated_at = now()
  WHERE id = p_run_id;
END;
$$;

-- ============================================================
-- RPC: create_payroll_adjustment
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_payroll_adjustment(
  p_employee_id uuid,
  p_adjustment_type public.payroll_adjustment_type,
  p_amount numeric,
  p_reason text,
  p_applied_in_period date,
  p_reason_ar text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_period_first date := date_trunc('month', p_applied_in_period)::date;
BEGIN
  IF NOT public.has_role(v_user_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can create payroll adjustments';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Adjustment amount must be positive';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.financial_periods
    WHERE period_month = v_period_first
      AND status IN ('closed', 'review')
  ) THEN
    RAISE EXCEPTION 'Cannot create adjustment for closed or review period';
  END IF;

  PERFORM set_config('app.via_rpc', 'true', true);

  INSERT INTO public.payroll_adjustments (
    employee_id, adjustment_type, amount, reason, reason_ar,
    applied_in_period, created_by, status
  ) VALUES (
    p_employee_id, p_adjustment_type, p_amount, p_reason, p_reason_ar,
    v_period_first, v_user_id, 'pending'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================================
-- RPC: approve_payroll_adjustment (different user from creator)
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_payroll_adjustment(p_adjustment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_adj record;
BEGIN
  IF NOT public.has_role(v_user_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can approve payroll adjustments';
  END IF;

  SELECT * INTO v_adj FROM public.payroll_adjustments WHERE id = p_adjustment_id FOR UPDATE;
  IF v_adj IS NULL THEN
    RAISE EXCEPTION 'Adjustment not found';
  END IF;
  IF v_adj.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending adjustments can be approved (current: %)', v_adj.status;
  END IF;
  IF v_adj.created_by = v_user_id THEN
    RAISE EXCEPTION 'Segregation of duties: approver must differ from creator';
  END IF;

  PERFORM set_config('app.via_rpc', 'true', true);
  UPDATE public.payroll_adjustments
  SET status = 'approved',
      approved_by = v_user_id,
      approved_at = now()
  WHERE id = p_adjustment_id;
END;
$$;

-- ============================================================
-- RPC: reject_payroll_adjustment
-- ============================================================
CREATE OR REPLACE FUNCTION public.reject_payroll_adjustment(p_adjustment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_user_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can reject payroll adjustments';
  END IF;

  PERFORM set_config('app.via_rpc', 'true', true);
  UPDATE public.payroll_adjustments
  SET status = 'rejected',
      approved_by = v_user_id,
      approved_at = now()
  WHERE id = p_adjustment_id AND status = 'pending';
END;
$$;

-- ============================================================
-- RPC: reconcile_payroll_to_ledger
-- Compares HR view (payroll_run_lines paid) vs Accounting (employee_accounts cached_balance & journal totals)
-- ============================================================
CREATE OR REPLACE FUNCTION public.reconcile_payroll_to_ledger(p_period_month date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_first date := date_trunc('month', p_period_month)::date;
  v_hr_total numeric;
  v_paid_total numeric;
  v_journal_total numeric;
  v_mismatches jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'reception'::public.app_role)) THEN
    RAISE EXCEPTION 'Insufficient permissions for reconciliation';
  END IF;

  -- HR side: net amount on approved/paid runs for this period
  SELECT COALESCE(SUM(prl.net_amount), 0)
  INTO v_hr_total
  FROM public.payroll_run_lines prl
  JOIN public.payroll_runs pr ON pr.id = prl.payroll_run_id
  WHERE pr.period_month = v_period_first
    AND pr.status IN ('approved', 'paid');

  -- Cash-out side: salary payments recorded for this period
  SELECT COALESCE(SUM(sp.amount), 0)
  INTO v_paid_total
  FROM public.salary_payments sp
  WHERE sp.financial_period_month = v_period_first;

  -- Journal side: posted salary expense entries for this period
  SELECT COALESCE(SUM(jel.debit), 0)
  INTO v_journal_total
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  JOIN public.chart_of_accounts coa ON coa.id = jel.account_id
  WHERE je.entry_date >= v_period_first
    AND je.entry_date < (v_period_first + interval '1 month')::date
    AND je.status = 'posted'
    AND je.source_type = 'salary_payment'
    AND coa.account_type = 'expense';

  -- Per-employee mismatches (HR line vs salary_payment record)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'employee_id', emp_id,
    'hr_net', hr_net,
    'paid_amount', paid_amount,
    'difference', hr_net - paid_amount
  )), '[]'::jsonb)
  INTO v_mismatches
  FROM (
    SELECT 
      prl.employee_id AS emp_id,
      SUM(prl.net_amount) AS hr_net,
      COALESCE((
        SELECT SUM(sp.amount)
        FROM public.salary_payments sp
        WHERE sp.employee_id = prl.employee_id
          AND sp.financial_period_month = v_period_first
      ), 0) AS paid_amount
    FROM public.payroll_run_lines prl
    JOIN public.payroll_runs pr ON pr.id = prl.payroll_run_id
    WHERE pr.period_month = v_period_first
      AND pr.status = 'paid'
    GROUP BY prl.employee_id
    HAVING ABS(SUM(prl.net_amount) - COALESCE((
        SELECT SUM(sp.amount)
        FROM public.salary_payments sp
        WHERE sp.employee_id = prl.employee_id
          AND sp.financial_period_month = v_period_first
      ), 0)) > 0.01
  ) mismatch_data;

  RETURN jsonb_build_object(
    'period_month', v_period_first,
    'hr_total', v_hr_total,
    'paid_total', v_paid_total,
    'journal_total', v_journal_total,
    'hr_vs_paid_diff', v_hr_total - v_paid_total,
    'paid_vs_journal_diff', v_paid_total - v_journal_total,
    'is_reconciled', (
      ABS(v_hr_total - v_paid_total) < 0.01
      AND ABS(v_paid_total - v_journal_total) < 0.01
    ),
    'mismatches', v_mismatches,
    'checked_at', now()
  );
END;
$$;

-- ============================================================
-- Register approved RPCs
-- ============================================================
INSERT INTO public.approved_financial_rpcs (rpc_name, description) VALUES
  ('create_payroll_run', 'Phase 3: Generate draft payroll run for a month'),
  ('submit_payroll_run_for_review', 'Phase 3: Move payroll run from draft to review'),
  ('approve_payroll_run', 'Phase 3: Approve payroll run (segregated from reviewer)'),
  ('pay_payroll_run', 'Phase 3: Execute payments for approved payroll run'),
  ('cancel_payroll_run', 'Phase 3: Cancel a payroll run with reason'),
  ('create_payroll_adjustment', 'Phase 3: Create bonus/deduction adjustment'),
  ('approve_payroll_adjustment', 'Phase 3: Approve pending payroll adjustment'),
  ('reject_payroll_adjustment', 'Phase 3: Reject pending payroll adjustment'),
  ('reconcile_payroll_to_ledger', 'Phase 3: HR vs Accounting payroll reconciliation')
ON CONFLICT (rpc_name) DO NOTHING;

-- ============================================================
-- Block period close if payroll mismatch exists
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_payroll_reconciliation_for_close(p_period_month date)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recon jsonb;
BEGIN
  v_recon := public.reconcile_payroll_to_ledger(p_period_month);
  RETURN (v_recon->>'is_reconciled')::boolean;
END;
$$;
