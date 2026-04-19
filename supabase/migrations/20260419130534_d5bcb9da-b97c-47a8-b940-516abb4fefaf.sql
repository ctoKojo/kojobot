-- ============================================================================
-- PHASE 5: Financial Reports + Immutable Snapshots
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. financial_snapshots table (immutable period snapshots)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.financial_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month date NOT NULL,
  snapshot_type text NOT NULL CHECK (snapshot_type IN ('period_close', 'manual', 'pre_reopen')),
  
  -- Indexed summary columns (fast queries)
  total_revenue numeric(14,2) NOT NULL DEFAULT 0,
  total_expenses numeric(14,2) NOT NULL DEFAULT 0,
  total_salaries numeric(14,2) NOT NULL DEFAULT 0,
  net_profit numeric(14,2) NOT NULL DEFAULT 0,
  total_assets numeric(14,2) NOT NULL DEFAULT 0,
  total_liabilities numeric(14,2) NOT NULL DEFAULT 0,
  total_equity numeric(14,2) NOT NULL DEFAULT 0,
  cash_inflow numeric(14,2) NOT NULL DEFAULT 0,
  cash_outflow numeric(14,2) NOT NULL DEFAULT 0,
  net_cash_flow numeric(14,2) NOT NULL DEFAULT 0,
  
  -- Full report payloads (JSONB for flexibility)
  trial_balance jsonb NOT NULL DEFAULT '[]'::jsonb,
  income_statement jsonb NOT NULL DEFAULT '{}'::jsonb,
  balance_sheet jsonb NOT NULL DEFAULT '{}'::jsonb,
  cash_flow_statement jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Lineage tracking
  parent_snapshot_id uuid REFERENCES public.financial_snapshots(id),
  
  -- Integrity
  snapshot_hash text NOT NULL,
  
  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_financial_snapshots_period 
  ON public.financial_snapshots(period_month DESC);
CREATE INDEX IF NOT EXISTS idx_financial_snapshots_type 
  ON public.financial_snapshots(snapshot_type);

-- Enable RLS
ALTER TABLE public.financial_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS: read-only for admins/reception, no direct DML
CREATE POLICY "Admins and reception can view snapshots"
  ON public.financial_snapshots
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'reception'::app_role)
  );

-- Block all direct DML (only via approved RPCs)
CREATE TRIGGER enforce_via_rpc_financial_snapshots
  BEFORE INSERT OR UPDATE OR DELETE ON public.financial_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_via_rpc();

-- Immutability trigger: snapshots can NEVER be updated or deleted
CREATE OR REPLACE FUNCTION public.prevent_snapshot_modification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'SNAPSHOT_IMMUTABLE: Financial snapshots cannot be modified or deleted (id=%)', 
    COALESCE(OLD.id, NEW.id);
END;
$$;

CREATE TRIGGER z_prevent_snapshot_update
  BEFORE UPDATE ON public.financial_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_snapshot_modification();

CREATE TRIGGER z_prevent_snapshot_delete
  BEFORE DELETE ON public.financial_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_snapshot_modification();

-- ----------------------------------------------------------------------------
-- 2. get_income_statement RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_income_statement(p_period_month date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_status financial_period_status;
  v_snapshot jsonb;
  v_result jsonb;
  v_revenue numeric := 0;
  v_expenses numeric := 0;
  v_salaries numeric := 0;
  v_net_profit numeric := 0;
  v_revenue_lines jsonb;
  v_expense_lines jsonb;
BEGIN
  -- Permission check
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'reception'::app_role)) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Only admins and reception can view financial reports';
  END IF;

  -- Check period status
  SELECT status INTO v_period_status
  FROM financial_periods
  WHERE period_month = date_trunc('month', p_period_month)::date;

  -- If closed, read from snapshot
  IF v_period_status = 'closed' THEN
    SELECT income_statement INTO v_snapshot
    FROM financial_snapshots
    WHERE period_month = date_trunc('month', p_period_month)::date
      AND snapshot_type = 'period_close'
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_snapshot IS NOT NULL THEN
      RETURN v_snapshot || jsonb_build_object('source', 'snapshot');
    END IF;
  END IF;

  -- Live calculation from journal entries
  -- Revenue = sum of credits to revenue accounts
  SELECT COALESCE(SUM(jel.credit_amount - jel.debit_amount), 0),
         jsonb_agg(jsonb_build_object(
           'account_code', coa.code,
           'account_name', coa.name,
           'account_name_ar', coa.name_ar,
           'amount', SUM(jel.credit_amount - jel.debit_amount)
         ) ORDER BY coa.code)
  INTO v_revenue, v_revenue_lines
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.entry_id
  JOIN chart_of_accounts coa ON coa.id = jel.account_id
  WHERE je.status = 'posted'
    AND coa.account_type = 'revenue'
    AND date_trunc('month', je.entry_date) = date_trunc('month', p_period_month)
  GROUP BY coa.id, coa.code, coa.name, coa.name_ar;

  -- Expenses = sum of debits to expense accounts
  SELECT COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0),
         jsonb_agg(jsonb_build_object(
           'account_code', coa.code,
           'account_name', coa.name,
           'account_name_ar', coa.name_ar,
           'amount', SUM(jel.debit_amount - jel.credit_amount)
         ) ORDER BY coa.code)
  INTO v_expenses, v_expense_lines
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.entry_id
  JOIN chart_of_accounts coa ON coa.id = jel.account_id
  WHERE je.status = 'posted'
    AND coa.account_type = 'expense'
    AND date_trunc('month', je.entry_date) = date_trunc('month', p_period_month)
  GROUP BY coa.id, coa.code, coa.name, coa.name_ar;

  -- Salaries (subset of expenses for visibility)
  SELECT COALESCE(SUM(net_amount), 0) INTO v_salaries
  FROM salary_payments
  WHERE date_trunc('month', payment_date) = date_trunc('month', p_period_month);

  v_net_profit := v_revenue - v_expenses;

  v_result := jsonb_build_object(
    'period_month', p_period_month,
    'source', 'live',
    'total_revenue', v_revenue,
    'total_expenses', v_expenses,
    'total_salaries', v_salaries,
    'net_profit', v_net_profit,
    'revenue_breakdown', COALESCE(v_revenue_lines, '[]'::jsonb),
    'expense_breakdown', COALESCE(v_expense_lines, '[]'::jsonb),
    'generated_at', now()
  );

  RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. get_balance_sheet RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_balance_sheet(p_as_of_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_status financial_period_status;
  v_snapshot jsonb;
  v_assets numeric := 0;
  v_liabilities numeric := 0;
  v_equity numeric := 0;
  v_asset_lines jsonb;
  v_liability_lines jsonb;
  v_equity_lines jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'reception'::app_role)) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  -- Check if period is closed
  SELECT status INTO v_period_status
  FROM financial_periods
  WHERE period_month = date_trunc('month', p_as_of_date)::date;

  IF v_period_status = 'closed' THEN
    SELECT balance_sheet INTO v_snapshot
    FROM financial_snapshots
    WHERE period_month = date_trunc('month', p_as_of_date)::date
      AND snapshot_type = 'period_close'
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_snapshot IS NOT NULL THEN
      RETURN v_snapshot || jsonb_build_object('source', 'snapshot');
    END IF;
  END IF;

  -- Live calc: Assets (debit balances)
  SELECT COALESCE(SUM(balance), 0),
         jsonb_agg(jsonb_build_object(
           'account_code', code,
           'account_name', name,
           'account_name_ar', name_ar,
           'balance', balance
         ) ORDER BY code)
  INTO v_assets, v_asset_lines
  FROM (
    SELECT 
      coa.id, coa.code, coa.name, coa.name_ar,
      SUM(jel.debit_amount - jel.credit_amount) AS balance
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.entry_id
    JOIN chart_of_accounts coa ON coa.id = jel.account_id
    WHERE je.status = 'posted'
      AND coa.account_type = 'asset'
      AND je.entry_date <= p_as_of_date
    GROUP BY coa.id, coa.code, coa.name, coa.name_ar
    HAVING SUM(jel.debit_amount - jel.credit_amount) <> 0
  ) sub;

  -- Liabilities (credit balances)
  SELECT COALESCE(SUM(balance), 0),
         jsonb_agg(jsonb_build_object(
           'account_code', code,
           'account_name', name,
           'account_name_ar', name_ar,
           'balance', balance
         ) ORDER BY code)
  INTO v_liabilities, v_liability_lines
  FROM (
    SELECT 
      coa.id, coa.code, coa.name, coa.name_ar,
      SUM(jel.credit_amount - jel.debit_amount) AS balance
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.entry_id
    JOIN chart_of_accounts coa ON coa.id = jel.account_id
    WHERE je.status = 'posted'
      AND coa.account_type = 'liability'
      AND je.entry_date <= p_as_of_date
    GROUP BY coa.id, coa.code, coa.name, coa.name_ar
    HAVING SUM(jel.credit_amount - jel.debit_amount) <> 0
  ) sub;

  -- Equity (credit balances) + retained earnings (revenue - expenses to date)
  SELECT COALESCE(SUM(balance), 0),
         jsonb_agg(jsonb_build_object(
           'account_code', code,
           'account_name', name,
           'account_name_ar', name_ar,
           'balance', balance
         ) ORDER BY code)
  INTO v_equity, v_equity_lines
  FROM (
    SELECT 
      coa.id, coa.code, coa.name, coa.name_ar,
      SUM(jel.credit_amount - jel.debit_amount) AS balance
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.entry_id
    JOIN chart_of_accounts coa ON coa.id = jel.account_id
    WHERE je.status = 'posted'
      AND coa.account_type = 'equity'
      AND je.entry_date <= p_as_of_date
    GROUP BY coa.id, coa.code, coa.name, coa.name_ar
    HAVING SUM(jel.credit_amount - jel.debit_amount) <> 0
  ) sub;

  -- Add retained earnings (net of revenue - expenses)
  DECLARE
    v_retained numeric := 0;
  BEGIN
    SELECT COALESCE(SUM(
      CASE 
        WHEN coa.account_type = 'revenue' THEN jel.credit_amount - jel.debit_amount
        WHEN coa.account_type = 'expense' THEN -(jel.debit_amount - jel.credit_amount)
        ELSE 0
      END
    ), 0) INTO v_retained
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.entry_id
    JOIN chart_of_accounts coa ON coa.id = jel.account_id
    WHERE je.status = 'posted'
      AND coa.account_type IN ('revenue', 'expense')
      AND je.entry_date <= p_as_of_date;
    
    v_equity := v_equity + v_retained;
    
    IF v_retained <> 0 THEN
      v_equity_lines := COALESCE(v_equity_lines, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
          'account_code', '3900',
          'account_name', 'Retained Earnings (calculated)',
          'account_name_ar', 'الأرباح المحتجزة (محسوبة)',
          'balance', v_retained
        )
      );
    END IF;
  END;

  RETURN jsonb_build_object(
    'as_of_date', p_as_of_date,
    'source', 'live',
    'total_assets', v_assets,
    'total_liabilities', v_liabilities,
    'total_equity', v_equity,
    'balanced', (v_assets - (v_liabilities + v_equity)) BETWEEN -0.01 AND 0.01,
    'difference', v_assets - (v_liabilities + v_equity),
    'assets', COALESCE(v_asset_lines, '[]'::jsonb),
    'liabilities', COALESCE(v_liability_lines, '[]'::jsonb),
    'equity', COALESCE(v_equity_lines, '[]'::jsonb),
    'generated_at', now()
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. get_cash_flow_statement RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_cash_flow_statement(p_period_month date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_status financial_period_status;
  v_snapshot jsonb;
  v_inflow numeric := 0;
  v_outflow numeric := 0;
  v_inflow_breakdown jsonb;
  v_outflow_breakdown jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'reception'::app_role)) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  SELECT status INTO v_period_status
  FROM financial_periods
  WHERE period_month = date_trunc('month', p_period_month)::date;

  IF v_period_status = 'closed' THEN
    SELECT cash_flow_statement INTO v_snapshot
    FROM financial_snapshots
    WHERE period_month = date_trunc('month', p_period_month)::date
      AND snapshot_type = 'period_close'
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_snapshot IS NOT NULL THEN
      RETURN v_snapshot || jsonb_build_object('source', 'snapshot');
    END IF;
  END IF;

  -- Inflows: payments received
  SELECT COALESCE(SUM(amount), 0),
         jsonb_build_object(
           'cash', COALESCE(SUM(amount) FILTER (WHERE payment_method = 'cash'), 0),
           'transfer', COALESCE(SUM(amount) FILTER (WHERE payment_method = 'transfer'), 0),
           'paymob', COALESCE(SUM(amount) FILTER (WHERE payment_method = 'paymob'), 0),
           'stripe', COALESCE(SUM(amount) FILTER (WHERE payment_method = 'stripe'), 0)
         )
  INTO v_inflow, v_inflow_breakdown
  FROM payments
  WHERE date_trunc('month', payment_date) = date_trunc('month', p_period_month);

  -- Outflows: expenses + salaries
  DECLARE
    v_exp numeric := 0;
    v_sal numeric := 0;
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_exp
    FROM expenses
    WHERE date_trunc('month', expense_date) = date_trunc('month', p_period_month);
    
    SELECT COALESCE(SUM(net_amount), 0) INTO v_sal
    FROM salary_payments
    WHERE date_trunc('month', payment_date) = date_trunc('month', p_period_month);
    
    v_outflow := v_exp + v_sal;
    v_outflow_breakdown := jsonb_build_object(
      'expenses', v_exp,
      'salaries', v_sal
    );
  END;

  RETURN jsonb_build_object(
    'period_month', p_period_month,
    'source', 'live',
    'cash_inflow', v_inflow,
    'cash_outflow', v_outflow,
    'net_cash_flow', v_inflow - v_outflow,
    'inflow_breakdown', v_inflow_breakdown,
    'outflow_breakdown', v_outflow_breakdown,
    'generated_at', now()
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. close_period_v2: full orchestrated period close with snapshot
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_period_v2(
  p_period_month date,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_id uuid;
  v_period_status financial_period_status;
  v_user_id uuid := auth.uid();
  v_trial_balance jsonb;
  v_income_stmt jsonb;
  v_balance_sheet jsonb;
  v_cash_flow jsonb;
  v_snapshot_id uuid;
  v_snapshot_hash text;
  v_data_quality_check jsonb;
  v_payroll_check jsonb;
  v_period_month_normalized date;
BEGIN
  -- Set RPC context
  PERFORM set_config('app.via_rpc', 'true', true);

  -- Permission
  IF NOT public.has_role(v_user_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Only admins can close periods';
  END IF;

  v_period_month_normalized := date_trunc('month', p_period_month)::date;

  -- Lock and check period
  SELECT id, status INTO v_period_id, v_period_status
  FROM financial_periods
  WHERE period_month = v_period_month_normalized
  FOR UPDATE;

  IF v_period_id IS NULL THEN
    RAISE EXCEPTION 'PERIOD_NOT_FOUND: No financial period for %', v_period_month_normalized;
  END IF;

  IF v_period_status = 'closed' THEN
    RAISE EXCEPTION 'PERIOD_ALREADY_CLOSED: Period % is already closed', v_period_month_normalized;
  END IF;

  -- Step 1: Refresh materialized views
  PERFORM public.refresh_account_balances_mv();

  -- Step 2: Run pre-close gates
  -- 2a. Data quality check
  v_data_quality_check := public.check_data_quality_for_close(v_period_month_normalized);
  IF (v_data_quality_check->>'has_blocking_issues')::boolean THEN
    RAISE EXCEPTION 'CLOSE_BLOCKED_DATA_QUALITY: %', v_data_quality_check::text;
  END IF;

  -- 2b. Payroll reconciliation check
  v_payroll_check := public.check_payroll_reconciliation_for_close(v_period_month_normalized);
  IF (v_payroll_check->>'has_mismatch')::boolean THEN
    RAISE EXCEPTION 'CLOSE_BLOCKED_PAYROLL: %', v_payroll_check::text;
  END IF;

  -- Step 3: Generate all reports
  v_trial_balance := public.get_trial_balance(v_period_month_normalized);
  
  -- Validate trial balance is balanced
  IF NOT (v_trial_balance->>'balanced')::boolean THEN
    RAISE EXCEPTION 'CLOSE_BLOCKED_UNBALANCED: Trial balance not balanced. Difference: %', 
      v_trial_balance->>'difference';
  END IF;

  v_income_stmt := public.get_income_statement(v_period_month_normalized);
  v_balance_sheet := public.get_balance_sheet(
    (v_period_month_normalized + INTERVAL '1 month' - INTERVAL '1 day')::date
  );
  v_cash_flow := public.get_cash_flow_statement(v_period_month_normalized);

  -- Step 4: Compute snapshot hash for tamper detection
  v_snapshot_hash := encode(
    digest(
      v_trial_balance::text || v_income_stmt::text || v_balance_sheet::text || v_cash_flow::text,
      'sha256'
    ),
    'hex'
  );

  -- Step 5: Insert immutable snapshot
  INSERT INTO financial_snapshots (
    period_month, snapshot_type,
    total_revenue, total_expenses, total_salaries, net_profit,
    total_assets, total_liabilities, total_equity,
    cash_inflow, cash_outflow, net_cash_flow,
    trial_balance, income_statement, balance_sheet, cash_flow_statement,
    snapshot_hash, created_by, notes
  ) VALUES (
    v_period_month_normalized,
    'period_close',
    COALESCE((v_income_stmt->>'total_revenue')::numeric, 0),
    COALESCE((v_income_stmt->>'total_expenses')::numeric, 0),
    COALESCE((v_income_stmt->>'total_salaries')::numeric, 0),
    COALESCE((v_income_stmt->>'net_profit')::numeric, 0),
    COALESCE((v_balance_sheet->>'total_assets')::numeric, 0),
    COALESCE((v_balance_sheet->>'total_liabilities')::numeric, 0),
    COALESCE((v_balance_sheet->>'total_equity')::numeric, 0),
    COALESCE((v_cash_flow->>'cash_inflow')::numeric, 0),
    COALESCE((v_cash_flow->>'cash_outflow')::numeric, 0),
    COALESCE((v_cash_flow->>'net_cash_flow')::numeric, 0),
    v_trial_balance, v_income_stmt, v_balance_sheet, v_cash_flow,
    v_snapshot_hash, v_user_id, p_notes
  ) RETURNING id INTO v_snapshot_id;

  -- Step 6: Mark period closed
  UPDATE financial_periods
  SET 
    status = 'closed',
    closed_at = now(),
    closed_by = v_user_id,
    notes = COALESCE(notes, '') || E'\n[CLOSE]: ' || COALESCE(p_notes, 'Period closed'),
    updated_at = now()
  WHERE id = v_period_id;

  RETURN jsonb_build_object(
    'success', true,
    'period_month', v_period_month_normalized,
    'snapshot_id', v_snapshot_id,
    'snapshot_hash', v_snapshot_hash,
    'closed_at', now(),
    'closed_by', v_user_id
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. reopen_period: emergency reopen with audit trail
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reopen_period(
  p_period_month date,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_id uuid;
  v_period_status financial_period_status;
  v_user_id uuid := auth.uid();
  v_existing_snapshot_id uuid;
  v_pre_reopen_snapshot_id uuid;
  v_period_month_normalized date;
BEGIN
  PERFORM set_config('app.via_rpc', 'true', true);

  IF NOT public.has_role(v_user_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Only admins can reopen periods';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'REASON_REQUIRED: A detailed reason (min 10 chars) is required to reopen a period';
  END IF;

  v_period_month_normalized := date_trunc('month', p_period_month)::date;

  SELECT id, status INTO v_period_id, v_period_status
  FROM financial_periods
  WHERE period_month = v_period_month_normalized
  FOR UPDATE;

  IF v_period_status <> 'closed' THEN
    RAISE EXCEPTION 'NOT_CLOSED: Period % is not closed (status=%)', 
      v_period_month_normalized, v_period_status;
  END IF;

  -- Find latest snapshot
  SELECT id INTO v_existing_snapshot_id
  FROM financial_snapshots
  WHERE period_month = v_period_month_normalized
    AND snapshot_type = 'period_close'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Create pre-reopen snapshot for audit trail (clone of existing)
  INSERT INTO financial_snapshots (
    period_month, snapshot_type,
    total_revenue, total_expenses, total_salaries, net_profit,
    total_assets, total_liabilities, total_equity,
    cash_inflow, cash_outflow, net_cash_flow,
    trial_balance, income_statement, balance_sheet, cash_flow_statement,
    snapshot_hash, parent_snapshot_id, created_by, notes
  )
  SELECT 
    period_month, 'pre_reopen'::text,
    total_revenue, total_expenses, total_salaries, net_profit,
    total_assets, total_liabilities, total_equity,
    cash_inflow, cash_outflow, net_cash_flow,
    trial_balance, income_statement, balance_sheet, cash_flow_statement,
    snapshot_hash, id, v_user_id,
    'Pre-reopen audit snapshot. Reason: ' || p_reason
  FROM financial_snapshots
  WHERE id = v_existing_snapshot_id
  RETURNING id INTO v_pre_reopen_snapshot_id;

  -- Reopen period
  UPDATE financial_periods
  SET 
    status = 'open',
    reopened_at = now(),
    reopened_by = v_user_id,
    reopen_reason = p_reason,
    updated_at = now()
  WHERE id = v_period_id;

  RETURN jsonb_build_object(
    'success', true,
    'period_month', v_period_month_normalized,
    'pre_reopen_snapshot_id', v_pre_reopen_snapshot_id,
    'reopened_at', now(),
    'reopened_by', v_user_id,
    'reason', p_reason
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Register RPCs in approved registry
-- ----------------------------------------------------------------------------
INSERT INTO public.approved_financial_rpcs (rpc_name, version, description) VALUES
  ('get_income_statement', 1, 'Generate income statement (live or from snapshot)'),
  ('get_balance_sheet', 1, 'Generate balance sheet (live or from snapshot)'),
  ('get_cash_flow_statement', 1, 'Generate cash flow statement (live or from snapshot)'),
  ('close_period_v2', 1, 'Full period close with snapshot generation'),
  ('reopen_period', 1, 'Emergency period reopen with audit trail')
ON CONFLICT (rpc_name) DO UPDATE SET version = EXCLUDED.version, description = EXCLUDED.description;

-- Grants
GRANT EXECUTE ON FUNCTION public.get_income_statement(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_balance_sheet(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cash_flow_statement(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_period_v2(date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_period(date, text) TO authenticated;