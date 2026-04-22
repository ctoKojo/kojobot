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
  -- Permission: admin only
  SELECT public.has_role(v_caller, 'admin'::app_role) INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Permission denied: admin only';
  END IF;

  -- Validation
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF p_from_code IS NULL OR p_to_code IS NULL THEN
    RAISE EXCEPTION 'Both source and destination accounts are required';
  END IF;

  IF p_from_code = p_to_code THEN
    RAISE EXCEPTION 'Source and destination must be different accounts';
  END IF;

  -- Restrict to treasury accounts only
  IF p_from_code NOT IN ('1110','1120','1130','1140')
     OR p_to_code NOT IN ('1110','1120','1130','1140') THEN
    RAISE EXCEPTION 'Only treasury accounts (1110, 1120, 1130, 1140) are allowed';
  END IF;

  -- Resolve account ids + names
  SELECT id, name INTO v_from_id, v_from_name
  FROM public.chart_of_accounts WHERE code = p_from_code AND is_active = true;
  SELECT id, name INTO v_to_id, v_to_name
  FROM public.chart_of_accounts WHERE code = p_to_code AND is_active = true;

  IF v_from_id IS NULL OR v_to_id IS NULL THEN
    RAISE EXCEPTION 'Treasury accounts not found or inactive';
  END IF;

  -- Period must be open
  v_period_month := date_trunc('month', p_transfer_date)::date;
  SELECT status::text INTO v_period_status
  FROM public.financial_periods
  WHERE period_month = v_period_month;

  IF v_period_status IS NOT NULL AND v_period_status NOT IN ('open','review') THEN
    RAISE EXCEPTION 'Cannot post transfer to a closed period (%)', v_period_status;
  END IF;

  -- Sufficient funds check
  SELECT COALESCE(SUM(jel.debit) - SUM(jel.credit), 0)
  INTO v_from_balance
  FROM public.journal_entry_lines jel
  WHERE jel.account_id = v_from_id
    AND jel.posted_at IS NOT NULL;

  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance in source account (% available, % requested)',
      v_from_balance, p_amount;
  END IF;

  -- Create journal entry
  v_voucher := 'TRF-' || to_char(p_transfer_date, 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6);

  INSERT INTO public.journal_entries (
    voucher_no, entry_date, source, source_id, status,
    description, financial_period_month, created_by
  ) VALUES (
    v_voucher, p_transfer_date, 'manual', NULL, 'draft',
    'TREASURY_TRANSFER: ' || v_from_name || ' → ' || v_to_name
      || COALESCE(' (' || p_notes || ')', ''),
    v_period_month, v_caller
  )
  RETURNING id INTO v_entry_id;

  -- Lines: Debit destination | Credit source
  INSERT INTO public.journal_entry_lines (
    journal_entry_id, line_no, account_id, debit, credit, description, financial_period_month
  ) VALUES
    (v_entry_id, 1, v_to_id,   p_amount, 0, 'Transfer in from ' || v_from_name, v_period_month),
    (v_entry_id, 2, v_from_id, 0, p_amount, 'Transfer out to '  || v_to_name,   v_period_month);

  -- Post entry
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

GRANT EXECUTE ON FUNCTION public.transfer_treasury_funds(text, text, numeric, date, text) TO authenticated;