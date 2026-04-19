
-- ============================================================================
-- PHASE 2.10.1: Subledger Idempotent Setup
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_or_create_customer_account(p_student_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_control uuid;
BEGIN
  IF p_student_id IS NULL THEN
    RAISE EXCEPTION 'STUDENT_ID_REQUIRED';
  END IF;

  SELECT id INTO v_id FROM public.customer_accounts WHERE student_id = p_student_id;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT id INTO v_control FROM public.chart_of_accounts WHERE code = '1210';
  IF v_control IS NULL THEN
    RAISE EXCEPTION 'CONTROL_ACCOUNT_MISSING: Students Receivable (1210) not found';
  END IF;

  PERFORM set_config('app.via_rpc', 'true', true);

  INSERT INTO public.customer_accounts (student_id, control_account_id)
  VALUES (p_student_id, v_control)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_employee_account(p_employee_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_control uuid;
BEGIN
  IF p_employee_id IS NULL THEN
    RAISE EXCEPTION 'EMPLOYEE_ID_REQUIRED';
  END IF;

  SELECT id INTO v_id FROM public.employee_accounts WHERE employee_id = p_employee_id;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT id INTO v_control FROM public.chart_of_accounts WHERE code = '2110';
  IF v_control IS NULL THEN
    RAISE EXCEPTION 'CONTROL_ACCOUNT_MISSING: Salaries Payable (2110) not found';
  END IF;

  PERFORM set_config('app.via_rpc', 'true', true);

  INSERT INTO public.employee_accounts (employee_id, control_account_id)
  VALUES (p_employee_id, v_control)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================================================
-- PHASE 2.10.2: Posting Helpers (resolve cash account from method)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_cash_account(
  p_method public.payment_method_type,
  p_transfer public.transfer_method_type DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_method = 'cash' THEN
    SELECT gl_account_id INTO v_id
      FROM public.payment_accounts
     WHERE payment_method = 'cash' AND is_active = true
     LIMIT 1;
  ELSE
    SELECT gl_account_id INTO v_id
      FROM public.payment_accounts
     WHERE payment_method = p_method
       AND transfer_type = p_transfer
       AND is_active = true
     LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_ACCOUNT_NOT_MAPPED: method=%, transfer=%', p_method, p_transfer;
  END IF;

  RETURN v_id;
END;
$$;

-- ============================================================================
-- PHASE 2.10.3: Post Payment Journal
-- Dr Cash/Bank   amount
-- Cr Subscription Revenue   amount
-- Updates customer subledger (Cr) — receivable decreases
-- ============================================================================

CREATE OR REPLACE FUNCTION public.post_payment_journal(p_payment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay record;
  v_je_id uuid;
  v_voucher text;
  v_period date;
  v_cash_acct uuid;
  v_revenue_acct uuid;
  v_ar_acct uuid;
  v_cust_acc uuid;
  v_user uuid := auth.uid();
BEGIN
  SELECT p.*, COALESCE(p.financial_period_month, date_trunc('month', p.payment_date)::date) AS period
    INTO v_pay
    FROM public.payments p
   WHERE p.id = p_payment_id;

  IF v_pay IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND';
  END IF;

  -- Skip if already posted
  IF EXISTS (SELECT 1 FROM public.journal_entries WHERE source='payment' AND source_id=p_payment_id) THEN
    RETURN NULL;
  END IF;

  v_period := v_pay.period;

  v_cash_acct := public.resolve_cash_account(
    v_pay.payment_method::public.payment_method_type,
    v_pay.transfer_type::public.transfer_method_type
  );

  SELECT id INTO v_revenue_acct FROM public.chart_of_accounts WHERE code='4100';
  SELECT id INTO v_ar_acct FROM public.chart_of_accounts WHERE code='1210';

  v_cust_acc := public.get_or_create_customer_account(v_pay.student_id);
  v_voucher := public.generate_voucher_no('payment', v_pay.payment_date);

  PERFORM set_config('app.via_rpc', 'true', true);

  INSERT INTO public.journal_entries (
    voucher_no, entry_date, status, source, source_id,
    description, description_ar, financial_period_month, created_by
  ) VALUES (
    v_voucher, v_pay.payment_date, 'draft', 'payment', p_payment_id,
    'Payment received #' || v_voucher,
    'تحصيل دفعة #' || v_voucher,
    v_period, COALESCE(v_user, v_pay.recorded_by)
  ) RETURNING id INTO v_je_id;

  INSERT INTO public.journal_entry_lines (
    journal_entry_id, line_no, account_id, debit, credit, financial_period_month, description
  ) VALUES (
    v_je_id, 1, v_cash_acct, v_pay.amount, 0, v_period, 'Cash/Bank receipt'
  );

  -- Credit customer subledger (AR control)
  INSERT INTO public.journal_entry_lines (
    journal_entry_id, line_no, account_id, customer_account_id,
    debit, credit, financial_period_month, description
  ) VALUES (
    v_je_id, 2, v_ar_acct, v_cust_acc,
    0, v_pay.amount, v_period, 'Reduce student receivable'
  );

  -- Post it
  PERFORM set_config('app.via_rpc', 'true', true);
  UPDATE public.journal_entries SET status='posted', posted_by = COALESCE(v_user, v_pay.recorded_by) WHERE id = v_je_id;

  RETURN v_je_id;
END;
$$;

-- ============================================================================
-- PHASE 2.10.4: Post Expense Journal
-- Dr Expense    amount
-- Cr Cash/Bank  amount
-- ============================================================================

CREATE OR REPLACE FUNCTION public.post_expense_journal(p_expense_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exp record;
  v_je_id uuid;
  v_voucher text;
  v_period date;
  v_cash_acct uuid;
  v_expense_acct uuid;
  v_user uuid := auth.uid();
BEGIN
  SELECT * INTO v_exp FROM public.expenses WHERE id = p_expense_id;
  IF v_exp IS NULL THEN
    RAISE EXCEPTION 'EXPENSE_NOT_FOUND';
  END IF;

  IF EXISTS (SELECT 1 FROM public.journal_entries WHERE source='expense' AND source_id=p_expense_id) THEN
    RETURN NULL;
  END IF;

  v_period := COALESCE(v_exp.financial_period_month, date_trunc('month', v_exp.expense_date)::date);

  v_cash_acct := public.resolve_cash_account(v_exp.payment_method, v_exp.transfer_type);

  -- Map category to GL account; fallback 5390 Other
  SELECT id INTO v_expense_acct FROM public.chart_of_accounts WHERE code = CASE
    WHEN lower(v_exp.category) IN ('rent') THEN '5310'
    WHEN lower(v_exp.category) IN ('utilities','utility') THEN '5320'
    WHEN lower(v_exp.category) IN ('marketing','ads') THEN '5330'
    WHEN lower(v_exp.category) IN ('supplies','office') THEN '5340'
    WHEN lower(v_exp.category) IN ('software','tools') THEN '5350'
    ELSE '5390'
  END;

  v_voucher := public.generate_voucher_no('expense', v_exp.expense_date);

  PERFORM set_config('app.via_rpc', 'true', true);

  INSERT INTO public.journal_entries (
    voucher_no, entry_date, status, source, source_id,
    description, description_ar, financial_period_month, created_by
  ) VALUES (
    v_voucher, v_exp.expense_date, 'draft', 'expense', p_expense_id,
    'Expense: ' || COALESCE(v_exp.description, ''),
    COALESCE(v_exp.description_ar, v_exp.description),
    v_period, COALESCE(v_user, v_exp.recorded_by)
  ) RETURNING id INTO v_je_id;

  INSERT INTO public.journal_entry_lines (journal_entry_id, line_no, account_id, debit, credit, financial_period_month, description)
  VALUES (v_je_id, 1, v_expense_acct, v_exp.amount, 0, v_period, 'Expense recognized');

  INSERT INTO public.journal_entry_lines (journal_entry_id, line_no, account_id, debit, credit, financial_period_month, description)
  VALUES (v_je_id, 2, v_cash_acct, 0, v_exp.amount, v_period, 'Cash/Bank outflow');

  PERFORM set_config('app.via_rpc', 'true', true);
  UPDATE public.journal_entries SET status='posted', posted_by = COALESCE(v_user, v_exp.recorded_by) WHERE id = v_je_id;

  RETURN v_je_id;
END;
$$;

-- ============================================================================
-- PHASE 2.10.5: Post Salary Journal
-- Dr Salaries Expense   amount
-- Cr Cash/Bank          amount
-- Updates employee subledger (Dr salary paid -> reduce payable)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.post_salary_journal(p_salary_payment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sp record;
  v_je_id uuid;
  v_voucher text;
  v_period date;
  v_cash_acct uuid;
  v_salary_exp_acct uuid;
  v_payable_acct uuid;
  v_emp_acc uuid;
  v_user uuid := auth.uid();
BEGIN
  SELECT * INTO v_sp FROM public.salary_payments WHERE id = p_salary_payment_id;
  IF v_sp IS NULL THEN
    RAISE EXCEPTION 'SALARY_PAYMENT_NOT_FOUND';
  END IF;

  IF EXISTS (SELECT 1 FROM public.journal_entries WHERE source='salary' AND source_id=p_salary_payment_id) THEN
    RETURN NULL;
  END IF;

  v_period := COALESCE(v_sp.financial_period_month, date_trunc('month', v_sp.payment_date)::date);

  v_cash_acct := public.resolve_cash_account(v_sp.payment_method, v_sp.transfer_type);

  SELECT id INTO v_salary_exp_acct FROM public.chart_of_accounts WHERE code='5100';
  SELECT id INTO v_payable_acct FROM public.chart_of_accounts WHERE code='2110';

  v_emp_acc := public.get_or_create_employee_account(v_sp.employee_id);

  v_voucher := public.generate_voucher_no('salary', v_sp.payment_date);

  PERFORM set_config('app.via_rpc', 'true', true);

  INSERT INTO public.journal_entries (
    voucher_no, entry_date, status, source, source_id,
    description, description_ar, financial_period_month, created_by
  ) VALUES (
    v_voucher, v_sp.payment_date, 'draft', 'salary', p_salary_payment_id,
    'Salary payment #' || v_voucher,
    'صرف راتب #' || v_voucher,
    v_period, COALESCE(v_user, v_sp.paid_by)
  ) RETURNING id INTO v_je_id;

  -- Salary expense recognition (debit) — also tag employee subledger
  INSERT INTO public.journal_entry_lines (journal_entry_id, line_no, account_id, employee_account_id, debit, credit, financial_period_month, description)
  VALUES (v_je_id, 1, v_salary_exp_acct, v_emp_acc, v_sp.amount, 0, v_period, 'Salary expense');

  -- Cash outflow
  INSERT INTO public.journal_entry_lines (journal_entry_id, line_no, account_id, debit, credit, financial_period_month, description)
  VALUES (v_je_id, 2, v_cash_acct, 0, v_sp.amount, v_period, 'Cash/Bank outflow');

  PERFORM set_config('app.via_rpc', 'true', true);
  UPDATE public.journal_entries SET status='posted', posted_by = COALESCE(v_user, v_sp.paid_by) WHERE id = v_je_id;

  RETURN v_je_id;
END;
$$;

-- ============================================================================
-- PHASE 2.10.6: Reverse Journal Entry
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reverse_journal_entry(p_entry_id uuid, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orig record;
  v_new_id uuid;
  v_voucher text;
  v_user uuid := auth.uid();
  r record;
BEGIN
  IF NOT public.has_role(v_user, 'admin'::app_role) THEN
    RAISE EXCEPTION 'FORBIDDEN: Admin only';
  END IF;

  SELECT * INTO v_orig FROM public.journal_entries WHERE id = p_entry_id FOR UPDATE;
  IF v_orig IS NULL THEN
    RAISE EXCEPTION 'JOURNAL_NOT_FOUND';
  END IF;
  IF v_orig.status <> 'posted' THEN
    RAISE EXCEPTION 'CANNOT_REVERSE_NON_POSTED';
  END IF;
  IF v_orig.reversed_by_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'ALREADY_REVERSED';
  END IF;

  -- Period guard
  IF EXISTS (
    SELECT 1 FROM public.financial_periods fp
    WHERE fp.period_month = v_orig.financial_period_month
      AND fp.status IN ('closed','review')
  ) THEN
    RAISE EXCEPTION 'PERIOD_LOCKED: Cannot reverse entry in closed/review period';
  END IF;

  v_voucher := public.generate_voucher_no('reversal', CURRENT_DATE);

  PERFORM set_config('app.via_rpc', 'true', true);

  INSERT INTO public.journal_entries (
    voucher_no, entry_date, status, source, source_id,
    description, description_ar, financial_period_month,
    reversal_of_entry_id, created_by
  ) VALUES (
    v_voucher, CURRENT_DATE, 'draft', 'reversal', p_entry_id,
    'Reversal of ' || v_orig.voucher_no || ': ' || p_reason,
    'إلغاء قيد ' || v_orig.voucher_no || ': ' || p_reason,
    v_orig.financial_period_month, p_entry_id, v_user
  ) RETURNING id INTO v_new_id;

  -- Mirror lines (swap debit/credit)
  FOR r IN
    SELECT * FROM public.journal_entry_lines WHERE journal_entry_id = p_entry_id ORDER BY line_no
  LOOP
    INSERT INTO public.journal_entry_lines (
      journal_entry_id, line_no, account_id, customer_account_id, employee_account_id,
      debit, credit, description, financial_period_month
    ) VALUES (
      v_new_id, r.line_no, r.account_id, r.customer_account_id, r.employee_account_id,
      r.credit, r.debit,
      'Reversal: ' || COALESCE(r.description, ''),
      r.financial_period_month
    );
  END LOOP;

  PERFORM set_config('app.via_rpc', 'true', true);
  UPDATE public.journal_entries SET status='posted', posted_by = v_user WHERE id = v_new_id;

  PERFORM set_config('app.via_rpc', 'true', true);
  UPDATE public.journal_entries SET reversed_by_entry_id = v_new_id, status='reversed' WHERE id = p_entry_id;

  RETURN v_new_id;
END;
$$;

-- ============================================================================
-- PHASE 2.10.7: Compute & Rebuild Balances
-- ============================================================================

CREATE OR REPLACE FUNCTION public.compute_customer_balance(p_customer_account_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(jel.debit - jel.credit), 0)
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.journal_entry_id
   WHERE jel.customer_account_id = p_customer_account_id
     AND je.status = 'posted';
$$;

CREATE OR REPLACE FUNCTION public.compute_employee_balance(p_employee_account_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Employee subledger sits on a credit-normal control (Salaries Payable)
  -- Positive balance = amount we owe the employee
  SELECT COALESCE(SUM(jel.credit - jel.debit), 0)
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.journal_entry_id
   WHERE jel.employee_account_id = p_employee_account_id
     AND je.status = 'posted';
$$;

CREATE OR REPLACE FUNCTION public.rebuild_customer_balance(p_customer_account_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
BEGIN
  v_balance := public.compute_customer_balance(p_customer_account_id);
  PERFORM set_config('app.via_rpc', 'true', true);
  UPDATE public.customer_accounts
     SET cached_balance = v_balance, cached_balance_at = now()
   WHERE id = p_customer_account_id;
  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_employee_balance(p_employee_account_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
BEGIN
  v_balance := public.compute_employee_balance(p_employee_account_id);
  PERFORM set_config('app.via_rpc', 'true', true);
  UPDATE public.employee_accounts
     SET cached_balance = v_balance, cached_balance_at = now()
   WHERE id = p_employee_account_id;
  RETURN v_balance;
END;
$$;

-- ============================================================================
-- PHASE 2.10.8: Update Subledger Balances After JE Posting (Trigger)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.f_update_subledger_balances_after_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r record;
  v_new_balance numeric;
BEGIN
  IF NEW.status = 'posted' AND OLD.status IS DISTINCT FROM 'posted' THEN
    -- Update customer subledgers
    FOR r IN
      SELECT DISTINCT customer_account_id
        FROM public.journal_entry_lines
       WHERE journal_entry_id = NEW.id
         AND customer_account_id IS NOT NULL
    LOOP
      v_new_balance := public.compute_customer_balance(r.customer_account_id);
      PERFORM set_config('app.via_rpc', 'true', true);
      UPDATE public.customer_accounts
         SET cached_balance = v_new_balance, cached_balance_at = now()
       WHERE id = r.customer_account_id;
    END LOOP;

    -- Update employee subledgers
    FOR r IN
      SELECT DISTINCT employee_account_id
        FROM public.journal_entry_lines
       WHERE journal_entry_id = NEW.id
         AND employee_account_id IS NOT NULL
    LOOP
      v_new_balance := public.compute_employee_balance(r.employee_account_id);
      PERFORM set_config('app.via_rpc', 'true', true);
      UPDATE public.employee_accounts
         SET cached_balance = v_new_balance, cached_balance_at = now()
       WHERE id = r.employee_account_id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- Note: name f_ to run AFTER b_validate_journal_balance
CREATE TRIGGER f_update_subledger_balances_after_post_trg
  AFTER UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.f_update_subledger_balances_after_post();

-- ============================================================================
-- PHASE 2.10.9: Auto-Post Triggers (alphabetical c_ to run after period set)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.c_auto_post_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip if a JE already exists for this payment
  IF NOT EXISTS (
    SELECT 1 FROM public.journal_entries
    WHERE source='payment' AND source_id = NEW.id
  ) THEN
    PERFORM public.post_payment_journal(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.c_auto_post_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.journal_entries
    WHERE source='expense' AND source_id = NEW.id
  ) THEN
    PERFORM public.post_expense_journal(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.c_auto_post_salary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.journal_entries
    WHERE source='salary' AND source_id = NEW.id
  ) THEN
    PERFORM public.post_salary_journal(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER c_auto_post_payment_trg
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.c_auto_post_payment();

CREATE TRIGGER c_auto_post_expense_trg
  AFTER INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.c_auto_post_expense();

CREATE TRIGGER c_auto_post_salary_trg
  AFTER INSERT ON public.salary_payments
  FOR EACH ROW EXECUTE FUNCTION public.c_auto_post_salary();

-- ============================================================================
-- PHASE 2.10.10: Materialized View - Account Balances Monthly
-- ============================================================================

CREATE MATERIALIZED VIEW public.mv_account_balances_monthly AS
SELECT
  jel.account_id,
  jel.financial_period_month AS period_month,
  COALESCE(SUM(jel.debit), 0)::numeric(14,2) AS total_debit,
  COALESCE(SUM(jel.credit), 0)::numeric(14,2) AS total_credit,
  COALESCE(SUM(jel.debit - jel.credit), 0)::numeric(14,2) AS net_balance,
  COUNT(*) AS line_count,
  MAX(jel.posted_at) AS last_activity_at
FROM public.journal_entry_lines jel
JOIN public.journal_entries je ON je.id = jel.journal_entry_id
WHERE je.status = 'posted'
GROUP BY jel.account_id, jel.financial_period_month;

CREATE UNIQUE INDEX idx_mv_acct_bal_uk ON public.mv_account_balances_monthly(account_id, period_month);
CREATE INDEX idx_mv_acct_bal_period ON public.mv_account_balances_monthly(period_month);

-- Refresh helper with advisory lock
CREATE OR REPLACE FUNCTION public.refresh_account_balances_mv()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Try to acquire lock; skip if already running
  IF pg_try_advisory_xact_lock(hashtext('refresh_account_balances_mv')) THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_account_balances_monthly;
  END IF;
END;
$$;

-- ============================================================================
-- PHASE 2.10.11: Balance Integrity Tier 1 (real-time alert)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_balance_integrity(
  p_account_type public.balance_account_type,
  p_account_id uuid,
  p_cached numeric,
  p_method public.balance_alert_method DEFAULT 'trigger'
)
RETURNS boolean  -- true if mismatch detected
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_computed numeric;
  v_diff numeric;
  v_user uuid := auth.uid();
BEGIN
  IF p_account_type = 'customer' THEN
    v_computed := public.compute_customer_balance(p_account_id);
  ELSIF p_account_type = 'employee' THEN
    v_computed := public.compute_employee_balance(p_account_id);
  ELSE
    RETURN false;
  END IF;

  v_diff := COALESCE(p_cached, 0) - COALESCE(v_computed, 0);

  IF abs(v_diff) > 0.01 THEN
    INSERT INTO public.balance_alerts (
      account_type, account_id, cached_balance, computed_balance,
      difference, detected_by_method, detected_by, status
    ) VALUES (
      p_account_type, p_account_id, p_cached, v_computed,
      v_diff, p_method, v_user, 'pending'
    );
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

-- Auto-check when cached_balance is set on customer/employee accounts
CREATE OR REPLACE FUNCTION public.g_check_subledger_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'customer_accounts' AND NEW.cached_balance IS DISTINCT FROM OLD.cached_balance THEN
    PERFORM public.check_balance_integrity('customer'::public.balance_account_type, NEW.id, NEW.cached_balance, 'trigger'::public.balance_alert_method);
  ELSIF TG_TABLE_NAME = 'employee_accounts' AND NEW.cached_balance IS DISTINCT FROM OLD.cached_balance THEN
    PERFORM public.check_balance_integrity('employee'::public.balance_account_type, NEW.id, NEW.cached_balance, 'trigger'::public.balance_alert_method);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER g_check_customer_integrity_trg
  AFTER UPDATE OF cached_balance ON public.customer_accounts
  FOR EACH ROW EXECUTE FUNCTION public.g_check_subledger_integrity();

CREATE TRIGGER g_check_employee_integrity_trg
  AFTER UPDATE OF cached_balance ON public.employee_accounts
  FOR EACH ROW EXECUTE FUNCTION public.g_check_subledger_integrity();

-- ============================================================================
-- PHASE 2.10.12: Trial Balance helper
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_trial_balance(p_period_month date DEFAULT NULL)
RETURNS TABLE (
  account_code text,
  account_name text,
  account_name_ar text,
  account_type public.account_type,
  total_debit numeric,
  total_credit numeric,
  net_balance numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    coa.code, coa.name, coa.name_ar, coa.account_type,
    COALESCE(SUM(mv.total_debit), 0) AS total_debit,
    COALESCE(SUM(mv.total_credit), 0) AS total_credit,
    COALESCE(SUM(mv.net_balance), 0) AS net_balance
  FROM public.chart_of_accounts coa
  LEFT JOIN public.mv_account_balances_monthly mv ON mv.account_id = coa.id
   AND (p_period_month IS NULL OR mv.period_month <= p_period_month)
  WHERE coa.is_active = true
  GROUP BY coa.code, coa.name, coa.name_ar, coa.account_type, coa.id
  HAVING COALESCE(SUM(mv.total_debit), 0) <> 0 OR COALESCE(SUM(mv.total_credit), 0) <> 0
  ORDER BY coa.code;
$$;

-- ============================================================================
-- PHASE 2.10.13: Register approved RPCs
-- ============================================================================

INSERT INTO public.approved_financial_rpcs (rpc_name, description) VALUES
  ('resolve_cash_account', 'Resolves the GL account for a payment method'),
  ('compute_customer_balance', 'Live computation of customer balance from JE'),
  ('compute_employee_balance', 'Live computation of employee balance from JE'),
  ('refresh_account_balances_mv', 'Refresh materialized view with advisory lock'),
  ('check_balance_integrity', 'Tier 1 balance integrity check + alert'),
  ('get_trial_balance', 'Trial balance from materialized view')
ON CONFLICT (rpc_name) DO NOTHING;
