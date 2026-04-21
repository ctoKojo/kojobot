CREATE OR REPLACE FUNCTION public.get_pending_balance_alerts()
RETURNS TABLE (
  id uuid,
  account_type text,
  account_id uuid,
  account_label text,
  cached_balance numeric,
  computed_balance numeric,
  difference numeric,
  detected_at timestamptz,
  detected_by_method text,
  status text,
  notes text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'reception')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    ba.id,
    ba.account_type::text,
    ba.account_id,
    COALESCE(coa.code || ' - ' || coa.name, ba.account_id::text) AS account_label,
    ba.cached_balance,
    ba.computed_balance,
    ba.difference,
    ba.detected_at,
    ba.detected_by_method::text,
    ba.status::text,
    ba.notes
  FROM public.balance_alerts ba
  LEFT JOIN public.chart_of_accounts coa ON coa.id = ba.account_id
  WHERE ba.status = 'pending'
  ORDER BY ba.detected_at DESC
  LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_treasury_reconciliation_summary()
RETURNS TABLE (
  account_code text,
  account_name text,
  account_name_ar text,
  computed_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'reception')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    coa.code::text,
    coa.name::text,
    coa.name_ar::text,
    COALESCE(SUM(jel.debit) - SUM(jel.credit), 0)::numeric AS computed_balance
  FROM public.chart_of_accounts coa
  LEFT JOIN public.journal_entry_lines jel ON jel.account_id = coa.id
  LEFT JOIN public.journal_entries je ON je.id = jel.entry_id AND je.status = 'posted'
  WHERE coa.code IN ('1110','1120','1130','1140')
  GROUP BY coa.code, coa.name, coa.name_ar
  ORDER BY coa.code;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_treasury_adjustment(
  p_account_code text,
  p_actual_amount numeric,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_account_id uuid;
  v_overshort_id uuid;
  v_computed numeric;
  v_diff numeric;
  v_entry_id uuid;
  v_voucher text;
  v_today date := (now() AT TIME ZONE 'Africa/Cairo')::date;
  v_period_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Only admins can record treasury adjustments';
  END IF;

  IF p_actual_amount IS NULL OR p_actual_amount < 0 THEN
    RAISE EXCEPTION 'Invalid actual amount';
  END IF;

  SELECT id INTO v_account_id FROM public.chart_of_accounts
  WHERE code = p_account_code AND account_type = 'asset' AND is_active = true;
  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'Cash account % not found', p_account_code;
  END IF;

  SELECT id INTO v_overshort_id FROM public.chart_of_accounts WHERE code = '5910';
  IF v_overshort_id IS NULL THEN
    INSERT INTO public.chart_of_accounts (code, name, name_ar, account_type, normal_side, is_active, is_system)
    VALUES ('5910','Cash Over/Short','عجز/زيادة الخزنة','expense','debit',true,true)
    RETURNING id INTO v_overshort_id;
  END IF;

  SELECT COALESCE(SUM(jel.debit) - SUM(jel.credit), 0) INTO v_computed
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON je.id = jel.entry_id
  WHERE jel.account_id = v_account_id AND je.status = 'posted';

  v_diff := p_actual_amount - v_computed;

  IF abs(v_diff) < 0.01 THEN
    RETURN jsonb_build_object('ok', true, 'no_adjustment_needed', true, 'computed', v_computed);
  END IF;

  v_period_id := public.ensure_financial_period(v_today);
  v_voucher := 'ADJ-' || to_char(now() AT TIME ZONE 'Africa/Cairo','YYYYMMDDHH24MISS');

  INSERT INTO public.journal_entries (
    voucher_no, entry_date, source, status, description, created_by, posted_by, posted_at, financial_period_id
  ) VALUES (
    v_voucher, v_today, 'adjustment', 'posted',
    COALESCE(p_notes, 'Treasury reconciliation adjustment for ' || p_account_code),
    auth.uid(), auth.uid(), now(), v_period_id
  ) RETURNING id INTO v_entry_id;

  IF v_diff > 0 THEN
    INSERT INTO public.journal_entry_lines (entry_id, account_id, debit, credit, description)
    VALUES
      (v_entry_id, v_account_id, v_diff, 0, 'Cash surplus'),
      (v_entry_id, v_overshort_id, 0, v_diff, 'Surplus offset');
  ELSE
    INSERT INTO public.journal_entry_lines (entry_id, account_id, debit, credit, description)
    VALUES
      (v_entry_id, v_overshort_id, abs(v_diff), 0, 'Cash shortage'),
      (v_entry_id, v_account_id, 0, abs(v_diff), 'Shortage offset');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'entry_id', v_entry_id,
    'voucher_no', v_voucher,
    'difference', v_diff,
    'computed_before', v_computed,
    'actual', p_actual_amount
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_account_balances_mv()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'reception')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  BEGIN
    EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_account_balances_monthly';
  EXCEPTION WHEN undefined_table THEN
    NULL;
  WHEN feature_not_supported THEN
    EXECUTE 'REFRESH MATERIALIZED VIEW public.mv_account_balances_monthly';
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_current_month_period()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'reception')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN public.ensure_financial_period((now() AT TIME ZONE 'Africa/Cairo')::date);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_balance_alerts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_treasury_reconciliation_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_treasury_adjustment(text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_account_balances_mv() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_current_month_period() TO authenticated;