CREATE OR REPLACE FUNCTION public.get_payment_journal_reconciliation(
  p_period_month date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_allowed boolean;
  v_period_start date;
  v_period_end date;
  v_result jsonb;
BEGIN
  SELECT (public.has_role(v_caller, 'admin'::app_role)
       OR public.has_role(v_caller, 'reception'::app_role))
  INTO v_allowed;

  IF NOT COALESCE(v_allowed, false) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  v_period_start := date_trunc('month', p_period_month)::date;
  v_period_end := (v_period_start + INTERVAL '1 month')::date;

  WITH period_payments AS (
    SELECT
      p.id AS payment_id,
      p.subscription_id,
      p.student_id,
      p.amount,
      p.payment_date,
      p.payment_method,
      p.payment_type,
      p.financial_period_month,
      prof.full_name AS student_name,
      prof.full_name_ar AS student_name_ar
    FROM public.payments p
    LEFT JOIN public.profiles prof ON prof.user_id = p.student_id
    WHERE p.financial_period_month = v_period_start
  ),
  payment_journals AS (
    SELECT
      je.id AS entry_id,
      je.voucher_no,
      je.entry_date,
      je.source_id AS payment_id,
      je.total_debit,
      je.status::text AS entry_status,
      je.posted_at,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'line_no', jel.line_no,
            'account_code', coa.code,
            'account_name', coa.name,
            'account_name_ar', coa.name_ar,
            'debit', jel.debit,
            'credit', jel.credit,
            'is_customer', jel.customer_account_id IS NOT NULL
          ) ORDER BY jel.line_no
        )
        FROM public.journal_entry_lines jel
        JOIN public.chart_of_accounts coa ON coa.id = jel.account_id
        WHERE jel.journal_entry_id = je.id
      ) AS lines
    FROM public.journal_entries je
    WHERE je.source = 'payment'::journal_source_type
      AND je.financial_period_month = v_period_start
  ),
  payment_rows AS (
    SELECT
      pp.payment_id,
      pp.subscription_id,
      pp.student_id,
      pp.student_name,
      pp.student_name_ar,
      pp.amount,
      pp.payment_date,
      pp.payment_method,
      pp.payment_type,
      pj.entry_id,
      pj.voucher_no,
      pj.entry_status,
      pj.total_debit,
      pj.lines,
      CASE
        WHEN pj.entry_id IS NULL THEN 'missing_journal'
        WHEN pj.entry_status <> 'posted' THEN 'unposted'
        WHEN pj.total_debit <> pp.amount THEN 'amount_mismatch'
        ELSE 'matched'
      END AS reconciliation_status
    FROM period_payments pp
    LEFT JOIN payment_journals pj ON pj.payment_id = pp.payment_id
  ),
  -- Orphan journals: payment-source entries with no matching payment in period
  orphan_journals AS (
    SELECT
      pj.entry_id,
      pj.voucher_no,
      pj.entry_date,
      pj.payment_id,
      pj.total_debit,
      pj.entry_status,
      pj.lines
    FROM payment_journals pj
    WHERE NOT EXISTS (
      SELECT 1 FROM period_payments pp WHERE pp.payment_id = pj.payment_id
    )
  ),
  -- Subscriptions touching the period (created in period or had payments in period)
  period_subscriptions AS (
    SELECT DISTINCT s.id, s.student_id, s.total_amount, s.status, s.created_at,
           prof.full_name AS student_name,
           prof.full_name_ar AS student_name_ar
    FROM public.subscriptions s
    LEFT JOIN public.profiles prof ON prof.user_id = s.student_id
    WHERE s.id IN (
      SELECT subscription_id FROM period_payments
      UNION
      SELECT id FROM public.subscriptions
      WHERE date_trunc('month', created_at)::date = v_period_start
    )
  ),
  subscription_summary AS (
    SELECT
      ps.id AS subscription_id,
      ps.student_id,
      ps.student_name,
      ps.student_name_ar,
      ps.total_amount,
      ps.status,
      ps.created_at,
      COALESCE((SELECT SUM(amount) FROM public.payments WHERE subscription_id = ps.id), 0) AS total_paid_alltime,
      COALESCE((SELECT SUM(amount) FROM public.payments
                WHERE subscription_id = ps.id
                  AND financial_period_month = v_period_start), 0) AS paid_in_period,
      COALESCE((SELECT SUM(je.total_debit) FROM public.journal_entries je
                JOIN public.payments p2 ON p2.id = je.source_id
                WHERE p2.subscription_id = ps.id
                  AND je.source = 'payment'::journal_source_type
                  AND je.financial_period_month = v_period_start
                  AND je.status = 'posted'::journal_entry_status), 0) AS journaled_in_period
    FROM period_subscriptions ps
  )
  SELECT jsonb_build_object(
    'period_month', v_period_start,
    'totals', jsonb_build_object(
      'payments_count', (SELECT COUNT(*) FROM period_payments),
      'payments_amount', COALESCE((SELECT SUM(amount) FROM period_payments), 0),
      'journals_count', (SELECT COUNT(*) FROM payment_journals),
      'journals_amount', COALESCE((SELECT SUM(total_debit) FROM payment_journals), 0),
      'matched_count', (SELECT COUNT(*) FROM payment_rows WHERE reconciliation_status = 'matched'),
      'missing_journal_count', (SELECT COUNT(*) FROM payment_rows WHERE reconciliation_status = 'missing_journal'),
      'amount_mismatch_count', (SELECT COUNT(*) FROM payment_rows WHERE reconciliation_status = 'amount_mismatch'),
      'unposted_count', (SELECT COUNT(*) FROM payment_rows WHERE reconciliation_status = 'unposted'),
      'orphan_journal_count', (SELECT COUNT(*) FROM orphan_journals),
      'subscriptions_count', (SELECT COUNT(*) FROM subscription_summary)
    ),
    'rows', COALESCE((
      SELECT jsonb_agg(to_jsonb(pr.*) ORDER BY pr.payment_date DESC, pr.payment_id)
      FROM payment_rows pr
    ), '[]'::jsonb),
    'orphan_journals', COALESCE((
      SELECT jsonb_agg(to_jsonb(oj.*) ORDER BY oj.entry_date DESC)
      FROM orphan_journals oj
    ), '[]'::jsonb),
    'subscriptions', COALESCE((
      SELECT jsonb_agg(to_jsonb(ss.*) ORDER BY ss.created_at DESC)
      FROM subscription_summary ss
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_payment_journal_reconciliation(date) TO authenticated;