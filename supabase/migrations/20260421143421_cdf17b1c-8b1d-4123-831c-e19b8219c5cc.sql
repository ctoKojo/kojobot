-- Treasury Activation: Backfill historical journal entries for existing payments/expenses/salaries
-- Auto-post triggers + posting functions already exist. This adds the historical backfill RPC
-- and ensures subledger accounts auto-bootstrap.

-- 1) Backfill RPC: idempotent, processes existing payments/expenses/salary_payments
CREATE OR REPLACE FUNCTION public.backfill_historical_journal_entries(p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payment record;
  v_expense record;
  v_salary record;
  v_created_payment int := 0;
  v_created_expense int := 0;
  v_created_salary int := 0;
  v_skipped int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_je_id uuid;
BEGIN
  -- Admin-only guard
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'FORBIDDEN: admin role required';
  END IF;

  -- PAYMENTS (oldest first)
  FOR v_payment IN
    SELECT p.id, p.payment_date
      FROM public.payments p
     WHERE NOT EXISTS (
       SELECT 1 FROM public.journal_entries je
        WHERE je.source = 'payment' AND je.source_id = p.id
     )
     ORDER BY p.payment_date ASC, p.created_at ASC
  LOOP
    BEGIN
      IF p_dry_run THEN
        v_created_payment := v_created_payment + 1;
      ELSE
        v_je_id := public.post_payment_journal(v_payment.id);
        IF v_je_id IS NOT NULL THEN
          v_created_payment := v_created_payment + 1;
        ELSE
          v_skipped := v_skipped + 1;
        END IF;
      END IF;
    EXCEPTION WHEN others THEN
      v_errors := v_errors || jsonb_build_object(
        'source', 'payment',
        'id', v_payment.id,
        'error', SQLERRM
      );
    END;
  END LOOP;

  -- EXPENSES
  FOR v_expense IN
    SELECT e.id, e.expense_date
      FROM public.expenses e
     WHERE NOT EXISTS (
       SELECT 1 FROM public.journal_entries je
        WHERE je.source = 'expense' AND je.source_id = e.id
     )
     ORDER BY e.expense_date ASC, e.created_at ASC
  LOOP
    BEGIN
      IF p_dry_run THEN
        v_created_expense := v_created_expense + 1;
      ELSE
        v_je_id := public.post_expense_journal(v_expense.id);
        IF v_je_id IS NOT NULL THEN
          v_created_expense := v_created_expense + 1;
        ELSE
          v_skipped := v_skipped + 1;
        END IF;
      END IF;
    EXCEPTION WHEN others THEN
      v_errors := v_errors || jsonb_build_object(
        'source', 'expense',
        'id', v_expense.id,
        'error', SQLERRM
      );
    END;
  END LOOP;

  -- SALARY PAYMENTS (only paid ones)
  FOR v_salary IN
    SELECT s.id, s.paid_date
      FROM public.salary_payments s
     WHERE s.status = 'paid'
       AND NOT EXISTS (
         SELECT 1 FROM public.journal_entries je
          WHERE je.source = 'salary' AND je.source_id = s.id
       )
     ORDER BY s.paid_date ASC NULLS LAST, s.created_at ASC
  LOOP
    BEGIN
      IF p_dry_run THEN
        v_created_salary := v_created_salary + 1;
      ELSE
        v_je_id := public.post_salary_journal(v_salary.id);
        IF v_je_id IS NOT NULL THEN
          v_created_salary := v_created_salary + 1;
        ELSE
          v_skipped := v_skipped + 1;
        END IF;
      END IF;
    EXCEPTION WHEN others THEN
      v_errors := v_errors || jsonb_build_object(
        'source', 'salary',
        'id', v_salary.id,
        'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'created_payment_je', v_created_payment,
    'created_expense_je', v_created_expense,
    'created_salary_je', v_created_salary,
    'skipped', v_skipped,
    'errors', v_errors,
    'total_created', v_created_payment + v_created_expense + v_created_salary
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.backfill_historical_journal_entries(boolean) TO authenticated;

-- Mark RPC as approved (so it can be invoked even though it touches journal_entries via post_*_journal)
INSERT INTO public.approved_financial_rpcs (rpc_name, description)
VALUES ('backfill_historical_journal_entries', 'One-time backfill of journal entries for historical payments/expenses/salaries')
ON CONFLICT (rpc_name) DO NOTHING;

-- 2) Treasury balances RPC: returns live balances for cash accounts (1110/1120/1130/1140) from posted JE lines
CREATE OR REPLACE FUNCTION public.get_treasury_balances()
RETURNS TABLE (
  account_code text,
  account_name text,
  account_name_ar text,
  balance numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    coa.code,
    coa.name,
    coa.name_ar,
    COALESCE(SUM(jel.debit) - SUM(jel.credit), 0)::numeric AS balance
    FROM public.chart_of_accounts coa
    LEFT JOIN public.journal_entry_lines jel ON jel.account_id = coa.id AND jel.posted_at IS NOT NULL
   WHERE coa.code IN ('1110','1120','1130','1140')
   GROUP BY coa.code, coa.name, coa.name_ar
   ORDER BY coa.code;
$$;

GRANT EXECUTE ON FUNCTION public.get_treasury_balances() TO authenticated;

-- 3) Recent treasury transactions RPC: posted lines hitting cash accounts with metadata
CREATE OR REPLACE FUNCTION public.get_treasury_transactions(
  p_limit int DEFAULT 100,
  p_account_code text DEFAULT NULL,
  p_from_date date DEFAULT NULL,
  p_to_date date DEFAULT NULL,
  p_source text DEFAULT NULL
)
RETURNS TABLE (
  line_id uuid,
  entry_id uuid,
  voucher_no text,
  entry_date date,
  posted_at timestamptz,
  source text,
  source_id uuid,
  account_code text,
  account_name text,
  debit numeric,
  credit numeric,
  description text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    jel.id AS line_id,
    je.id AS entry_id,
    je.voucher_no,
    je.entry_date,
    jel.posted_at,
    je.source::text AS source,
    je.source_id,
    coa.code AS account_code,
    coa.name AS account_name,
    jel.debit,
    jel.credit,
    COALESCE(jel.description, je.description) AS description
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    JOIN public.chart_of_accounts coa ON coa.id = jel.account_id
   WHERE coa.code IN ('1110','1120','1130','1140')
     AND je.status = 'posted'
     AND (p_account_code IS NULL OR coa.code = p_account_code)
     AND (p_from_date IS NULL OR je.entry_date >= p_from_date)
     AND (p_to_date IS NULL OR je.entry_date <= p_to_date)
     AND (p_source IS NULL OR je.source::text = p_source)
   ORDER BY je.entry_date DESC, jel.posted_at DESC
   LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_treasury_transactions(int, text, date, date, text) TO authenticated;