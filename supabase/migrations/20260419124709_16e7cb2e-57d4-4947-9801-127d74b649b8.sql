
-- Revoke API access to materialized view
REVOKE ALL ON public.mv_account_balances_monthly FROM anon, authenticated;

-- Fix search_path on b_validate_journal_balance
CREATE OR REPLACE FUNCTION public.b_validate_journal_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_total_d numeric(14,2);
  v_total_c numeric(14,2);
BEGIN
  IF NEW.status = 'posted' AND (OLD.status IS DISTINCT FROM 'posted') THEN
    SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
      INTO v_total_d, v_total_c
    FROM public.journal_entry_lines
    WHERE journal_entry_id = NEW.id;

    IF v_total_d = 0 OR v_total_c = 0 THEN
      RAISE EXCEPTION 'JOURNAL_EMPTY: Cannot post entry % with no lines', NEW.voucher_no;
    END IF;

    IF abs(v_total_d - v_total_c) > 0.005 THEN
      RAISE EXCEPTION 'JOURNAL_UNBALANCED: voucher % debits (%) != credits (%)',
        NEW.voucher_no, v_total_d, v_total_c;
    END IF;

    NEW.total_debit := v_total_d;
    NEW.total_credit := v_total_c;
    NEW.posted_at := COALESCE(NEW.posted_at, now());

    UPDATE public.journal_entry_lines
       SET posted_at = NEW.posted_at,
           financial_period_month = NEW.financial_period_month
     WHERE journal_entry_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- Customer Ledger (transactions + running balance)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_customer_ledger(p_student_id uuid, p_limit int DEFAULT 200)
RETURNS TABLE (
  je_id uuid,
  voucher_no text,
  entry_date date,
  posted_at timestamptz,
  description text,
  description_ar text,
  source public.journal_source_type,
  source_id uuid,
  debit numeric,
  credit numeric,
  running_balance numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acc uuid;
  v_caller uuid := auth.uid();
  v_allowed boolean;
BEGIN
  -- Authorization: admin/reception, the student themselves, or linked parent
  SELECT (
    public.has_role(v_caller, 'admin'::app_role) OR
    public.has_role(v_caller, 'reception'::app_role) OR
    v_caller = p_student_id OR
    EXISTS (
      SELECT 1 FROM public.parent_students ps
      WHERE ps.student_id = p_student_id AND ps.parent_id = v_caller
    )
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT id INTO v_acc FROM public.customer_accounts WHERE student_id = p_student_id;
  IF v_acc IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH lines AS (
    SELECT je.id AS je_id, je.voucher_no, je.entry_date, je.posted_at,
           je.description, je.description_ar, je.source, je.source_id,
           jel.debit, jel.credit
      FROM public.journal_entry_lines jel
      JOIN public.journal_entries je ON je.id = jel.journal_entry_id
     WHERE jel.customer_account_id = v_acc
       AND je.status = 'posted'
     ORDER BY je.posted_at, je.entry_date, jel.line_no
     LIMIT p_limit
  )
  SELECT l.je_id, l.voucher_no, l.entry_date, l.posted_at,
         l.description, l.description_ar, l.source, l.source_id,
         l.debit, l.credit,
         SUM(l.debit - l.credit) OVER (ORDER BY l.posted_at, l.je_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
    FROM lines l;
END;
$$;

-- ============================================================================
-- Employee Ledger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_employee_ledger(p_employee_id uuid, p_limit int DEFAULT 200)
RETURNS TABLE (
  je_id uuid,
  voucher_no text,
  entry_date date,
  posted_at timestamptz,
  description text,
  description_ar text,
  source public.journal_source_type,
  source_id uuid,
  debit numeric,
  credit numeric,
  running_balance numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acc uuid;
  v_caller uuid := auth.uid();
BEGIN
  IF NOT (
    public.has_role(v_caller, 'admin'::app_role) OR
    public.has_role(v_caller, 'reception'::app_role) OR
    v_caller = p_employee_id
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT id INTO v_acc FROM public.employee_accounts WHERE employee_id = p_employee_id;
  IF v_acc IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH lines AS (
    SELECT je.id AS je_id, je.voucher_no, je.entry_date, je.posted_at,
           je.description, je.description_ar, je.source, je.source_id,
           jel.debit, jel.credit
      FROM public.journal_entry_lines jel
      JOIN public.journal_entries je ON je.id = jel.journal_entry_id
     WHERE jel.employee_account_id = v_acc
       AND je.status = 'posted'
     ORDER BY je.posted_at, je.entry_date, jel.line_no
     LIMIT p_limit
  )
  SELECT l.je_id, l.voucher_no, l.entry_date, l.posted_at,
         l.description, l.description_ar, l.source, l.source_id,
         l.debit, l.credit,
         SUM(l.credit - l.debit) OVER (ORDER BY l.posted_at, l.je_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
    FROM lines l;
END;
$$;

-- ============================================================================
-- Balance Alerts management
-- ============================================================================

CREATE OR REPLACE FUNCTION public.acknowledge_balance_alert(p_alert_id uuid, p_notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_user, 'admin'::app_role) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.balance_alerts
     SET status = 'acknowledged',
         acknowledged_at = now(),
         acknowledged_by = v_user,
         notes = COALESCE(p_notes, notes)
   WHERE id = p_alert_id AND status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_balance_from_alert(p_alert_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alert record;
  v_new_balance numeric;
  v_user uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_user, 'admin'::app_role) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_alert FROM public.balance_alerts WHERE id = p_alert_id FOR UPDATE;
  IF v_alert IS NULL THEN
    RAISE EXCEPTION 'ALERT_NOT_FOUND';
  END IF;

  IF v_alert.account_type = 'customer' THEN
    v_new_balance := public.rebuild_customer_balance(v_alert.account_id);
  ELSIF v_alert.account_type = 'employee' THEN
    v_new_balance := public.rebuild_employee_balance(v_alert.account_id);
  ELSE
    RAISE EXCEPTION 'UNSUPPORTED_ACCOUNT_TYPE';
  END IF;

  UPDATE public.balance_alerts
     SET status = 'rebuilt',
         rebuilt_at = now(),
         rebuilt_by = v_user
   WHERE id = p_alert_id;

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

-- ============================================================================
-- COA Tree fetcher (admin/reception view)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_coa_tree()
RETURNS TABLE (
  id uuid,
  code text,
  name text,
  name_ar text,
  account_type public.account_type,
  normal_side public.normal_side_type,
  parent_id uuid,
  is_control boolean,
  is_system boolean,
  is_active boolean,
  current_balance numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    coa.id, coa.code, coa.name, coa.name_ar, coa.account_type,
    coa.normal_side, coa.parent_id, coa.is_control, coa.is_system, coa.is_active,
    COALESCE(SUM(mv.net_balance), 0)::numeric(14,2) AS current_balance
  FROM public.chart_of_accounts coa
  LEFT JOIN public.mv_account_balances_monthly mv ON mv.account_id = coa.id
  GROUP BY coa.id
  ORDER BY coa.code;
$$;

INSERT INTO public.approved_financial_rpcs (rpc_name, description) VALUES
  ('get_customer_ledger', 'Customer ledger with running balance'),
  ('get_employee_ledger', 'Employee ledger with running balance'),
  ('acknowledge_balance_alert', 'Mark alert acknowledged'),
  ('rebuild_balance_from_alert', 'Rebuild cached balance from JE source-of-truth'),
  ('get_coa_tree', 'Chart of accounts tree with current balance')
ON CONFLICT (rpc_name) DO NOTHING;
