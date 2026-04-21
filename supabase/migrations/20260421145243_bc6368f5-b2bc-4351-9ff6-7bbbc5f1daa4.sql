-- 1) Ensure Opening Balance Equity account (3100) exists
INSERT INTO public.chart_of_accounts (code, name, name_ar, account_type, normal_side, is_system, is_active)
VALUES ('3100', 'Opening Balance Equity', 'رصيد افتتاحي', 'equity', 'credit', true, true)
ON CONFLICT (code) DO NOTHING;

-- 2) RPC: Set treasury opening balance (single lump sum into Cash 1110)
CREATE OR REPLACE FUNCTION public.set_treasury_opening_balance(
  p_amount numeric,
  p_as_of_date date DEFAULT (now() AT TIME ZONE 'Africa/Cairo')::date,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_admin boolean;
  v_cash_id uuid;
  v_opening_id uuid;
  v_entry_id uuid;
  v_voucher text;
  v_existing_count int;
  v_period_month date;
BEGIN
  SELECT public.has_role(v_caller, 'admin'::app_role) INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Permission denied: admin only';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Idempotency: marker is description starting with TREASURY_OPENING_BALANCE
  SELECT count(*) INTO v_existing_count
  FROM public.journal_entries
  WHERE source = 'manual'
    AND status = 'posted'
    AND description LIKE 'TREASURY_OPENING_BALANCE%';

  IF v_existing_count > 0 THEN
    RAISE EXCEPTION 'Opening balance already set. Reverse it first via journal adjustment.';
  END IF;

  SELECT id INTO v_cash_id FROM public.chart_of_accounts WHERE code = '1110';
  SELECT id INTO v_opening_id FROM public.chart_of_accounts WHERE code = '3100';

  IF v_cash_id IS NULL OR v_opening_id IS NULL THEN
    RAISE EXCEPTION 'Required accounts (1110 Cash, 3100 Opening Equity) missing';
  END IF;

  v_voucher := 'OB-' || to_char(p_as_of_date, 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6);
  v_period_month := date_trunc('month', p_as_of_date)::date;

  -- Create entry
  INSERT INTO public.journal_entries (
    voucher_no, entry_date, source, source_id, status,
    description, financial_period_month, created_by
  ) VALUES (
    v_voucher, p_as_of_date, 'manual', NULL, 'draft',
    'TREASURY_OPENING_BALANCE: ' || COALESCE(p_notes, 'Initial cash balance'),
    v_period_month, v_caller
  )
  RETURNING id INTO v_entry_id;

  -- Lines: Debit Cash | Credit Opening Equity
  INSERT INTO public.journal_entry_lines (
    journal_entry_id, line_no, account_id, debit, credit, description, financial_period_month
  )
  VALUES
    (v_entry_id, 1, v_cash_id, p_amount, 0, 'Opening cash balance', v_period_month),
    (v_entry_id, 2, v_opening_id, 0, p_amount, 'Opening equity offset', v_period_month);

  -- Update totals + post
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
    'amount', p_amount,
    'as_of_date', p_as_of_date
  );
END;
$$;

INSERT INTO public.approved_financial_rpcs (rpc_name, description)
VALUES ('set_treasury_opening_balance', 'Sets one-time treasury opening balance (Cash vs Opening Equity)')
ON CONFLICT (rpc_name) DO NOTHING;

REVOKE ALL ON FUNCTION public.set_treasury_opening_balance(numeric, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_treasury_opening_balance(numeric, date, text) TO authenticated;

-- 3) Status helper
CREATE OR REPLACE FUNCTION public.get_treasury_opening_balance_status()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT jsonb_build_object(
      'is_set', true,
      'entry_id', je.id,
      'voucher_no', je.voucher_no,
      'amount', (SELECT sum(debit) FROM public.journal_entry_lines WHERE journal_entry_id = je.id),
      'as_of_date', je.entry_date,
      'posted_at', je.posted_at,
      'description', je.description
    )
    FROM public.journal_entries je
    WHERE source = 'manual'
      AND status = 'posted'
      AND description LIKE 'TREASURY_OPENING_BALANCE%'
    ORDER BY je.posted_at DESC
    LIMIT 1),
    jsonb_build_object('is_set', false)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_treasury_opening_balance_status() TO authenticated;