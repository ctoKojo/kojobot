CREATE OR REPLACE FUNCTION public.transfer_treasury_funds(
  p_from_code text,
  p_to_code text,
  p_amount numeric,
  p_transfer_date date DEFAULT ((now() AT TIME ZONE 'Africa/Cairo'::text))::date,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_admin boolean;
  v_from_id uuid;
  v_to_id uuid;
  v_from_name text;
  v_to_name text;
  v_entry_id uuid;
  v_voucher text;
  v_period_month date;
  v_period_status text;
  v_from_balance numeric;
BEGIN
  SELECT public.has_role(v_caller, 'admin'::app_role) INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Permission denied: admin only';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF p_from_code IS NULL OR p_to_code IS NULL THEN
    RAISE EXCEPTION 'Both source and destination accounts are required';
  END IF;

  IF p_from_code = p_to_code THEN
    RAISE EXCEPTION 'Source and destination must be different accounts';
  END IF;

  IF p_from_code NOT IN ('1110','1120','1130','1140')
     OR p_to_code NOT IN ('1110','1120','1130','1140') THEN
    RAISE EXCEPTION 'Only treasury accounts (1110, 1120, 1130, 1140) are allowed';
  END IF;

  SELECT id, name INTO v_from_id, v_from_name
  FROM public.chart_of_accounts
  WHERE code = p_from_code AND is_active = true;

  SELECT id, name INTO v_to_id, v_to_name
  FROM public.chart_of_accounts
  WHERE code = p_to_code AND is_active = true;

  IF v_from_id IS NULL OR v_to_id IS NULL THEN
    RAISE EXCEPTION 'Treasury accounts not found or inactive';
  END IF;

  v_period_month := date_trunc('month', p_transfer_date)::date;
  SELECT status::text INTO v_period_status
  FROM public.financial_periods
  WHERE period_month = v_period_month;

  IF v_period_status IS NOT NULL AND v_period_status NOT IN ('open','review') THEN
    RAISE EXCEPTION 'Cannot post transfer to a closed period (%)', v_period_status;
  END IF;

  SELECT COALESCE(SUM(jel.debit) - SUM(jel.credit), 0)
  INTO v_from_balance
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je
    ON je.id = jel.journal_entry_id
   AND je.status = 'posted'
  WHERE jel.account_id = v_from_id;

  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance in source account (% available, % requested)',
      v_from_balance, p_amount;
  END IF;

  v_voucher := 'TRF-' || to_char(p_transfer_date, 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6);

  PERFORM set_config('app.via_rpc', 'true', true);

  INSERT INTO public.journal_entries (
    voucher_no,
    entry_date,
    source,
    source_id,
    status,
    description,
    financial_period_month,
    created_by
  ) VALUES (
    v_voucher,
    p_transfer_date,
    'manual',
    NULL,
    'draft',
    'TREASURY_TRANSFER: ' || v_from_name || ' → ' || v_to_name || COALESCE(' (' || p_notes || ')', ''),
    v_period_month,
    v_caller
  )
  RETURNING id INTO v_entry_id;

  PERFORM set_config('app.via_rpc', 'true', true);

  INSERT INTO public.journal_entry_lines (
    journal_entry_id,
    line_no,
    account_id,
    debit,
    credit,
    description,
    financial_period_month
  ) VALUES
    (v_entry_id, 1, v_to_id, p_amount, 0, 'Transfer in from ' || v_from_name, v_period_month),
    (v_entry_id, 2, v_from_id, 0, p_amount, 'Transfer out to ' || v_to_name, v_period_month);

  PERFORM set_config('app.via_rpc', 'true', true);

  UPDATE public.journal_entries
  SET total_debit = p_amount,
      total_credit = p_amount,
      status = 'posted',
      posted_at = now(),
      posted_by = v_caller
  WHERE id = v_entry_id;

  RETURN jsonb_build_object(
    'success', true,
    'entry_id', v_entry_id,
    'voucher_no', v_voucher,
    'from_account', p_from_code,
    'to_account', p_to_code,
    'amount', p_amount,
    'transfer_date', p_transfer_date
  );
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
    COALESCE(
      SUM(
        CASE
          WHEN je.id IS NOT NULL THEN jel.debit - jel.credit
          ELSE 0
        END
      ),
      0
    )::numeric AS computed_balance
  FROM public.chart_of_accounts coa
  LEFT JOIN public.journal_entry_lines jel
    ON jel.account_id = coa.id
  LEFT JOIN public.journal_entries je
    ON je.id = jel.journal_entry_id
   AND je.status = 'posted'
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
  v_period_month date := date_trunc('month', (now() AT TIME ZONE 'Africa/Cairo')::date)::date;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Only admins can record treasury adjustments';
  END IF;

  IF p_actual_amount IS NULL OR p_actual_amount < 0 THEN
    RAISE EXCEPTION 'Invalid actual amount';
  END IF;

  SELECT id INTO v_account_id
  FROM public.chart_of_accounts
  WHERE code = p_account_code AND account_type = 'asset' AND is_active = true;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'Cash account % not found', p_account_code;
  END IF;

  SELECT id INTO v_overshort_id
  FROM public.chart_of_accounts
  WHERE code = '5910';

  IF v_overshort_id IS NULL THEN
    INSERT INTO public.chart_of_accounts (code, name, name_ar, account_type, normal_side, is_active, is_system)
    VALUES ('5910','Cash Over/Short','عجز/زيادة الخزنة','expense','debit',true,true)
    RETURNING id INTO v_overshort_id;
  END IF;

  SELECT COALESCE(SUM(jel.debit) - SUM(jel.credit), 0)
  INTO v_computed
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je
    ON je.id = jel.journal_entry_id
   AND je.status = 'posted'
  WHERE jel.account_id = v_account_id;

  v_diff := p_actual_amount - v_computed;

  IF abs(v_diff) < 0.01 THEN
    RETURN jsonb_build_object('ok', true, 'no_adjustment_needed', true, 'computed', v_computed);
  END IF;

  v_voucher := 'ADJ-' || to_char(now() AT TIME ZONE 'Africa/Cairo','YYYYMMDDHH24MISS');

  PERFORM set_config('app.via_rpc', 'true', true);

  INSERT INTO public.journal_entries (
    voucher_no,
    entry_date,
    source,
    status,
    description,
    created_by,
    posted_by,
    posted_at,
    financial_period_month,
    total_debit,
    total_credit
  ) VALUES (
    v_voucher,
    v_today,
    'adjustment',
    'posted',
    COALESCE(p_notes, 'Treasury reconciliation adjustment for ' || p_account_code),
    auth.uid(),
    auth.uid(),
    now(),
    v_period_month,
    abs(v_diff),
    abs(v_diff)
  ) RETURNING id INTO v_entry_id;

  PERFORM set_config('app.via_rpc', 'true', true);

  IF v_diff > 0 THEN
    INSERT INTO public.journal_entry_lines (
      journal_entry_id,
      line_no,
      account_id,
      debit,
      credit,
      description,
      financial_period_month
    ) VALUES
      (v_entry_id, 1, v_account_id, v_diff, 0, 'Cash surplus', v_period_month),
      (v_entry_id, 2, v_overshort_id, 0, v_diff, 'Surplus offset', v_period_month);
  ELSE
    INSERT INTO public.journal_entry_lines (
      journal_entry_id,
      line_no,
      account_id,
      debit,
      credit,
      description,
      financial_period_month
    ) VALUES
      (v_entry_id, 1, v_overshort_id, abs(v_diff), 0, 'Cash shortage', v_period_month),
      (v_entry_id, 2, v_account_id, 0, abs(v_diff), 'Shortage offset', v_period_month);
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

INSERT INTO public.approved_financial_rpcs (rpc_name, description, version)
VALUES (
  'record_treasury_adjustment',
  'تسوية فروق مطابقة الخزينة مع إنشاء قيد محاسبي تلقائي',
  1
)
ON CONFLICT (rpc_name) DO UPDATE SET
  description = EXCLUDED.description;