-- RPC: record_treasury_opening_balance
-- Records an opening balance for a treasury (cash) account by creating a balanced
-- journal entry: Debit Cash account / Credit Owner Capital (3100).
-- This increases the treasury balance WITHOUT affecting revenue, expenses, or profit.
CREATE OR REPLACE FUNCTION public.record_treasury_opening_balance(
  p_account_code text,
  p_amount numeric,
  p_entry_date date DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_cash_account_id uuid;
  v_capital_account_id uuid;
  v_entry_id uuid;
  v_voucher text;
  v_today date := COALESCE(p_entry_date, (now() AT TIME ZONE 'Africa/Cairo')::date);
  v_period_month date;
  v_account_name text;
  v_account_name_ar text;
BEGIN
  -- Admin only
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can record opening balances';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Opening balance amount must be greater than 0';
  END IF;

  -- Resolve cash/treasury asset account
  SELECT id, name, name_ar INTO v_cash_account_id, v_account_name, v_account_name_ar
  FROM public.chart_of_accounts
  WHERE code = p_account_code AND account_type = 'asset' AND is_active = true;

  IF v_cash_account_id IS NULL THEN
    RAISE EXCEPTION 'Treasury account % not found or inactive', p_account_code;
  END IF;

  -- Resolve Owner Capital (3100) - equity account, normal side credit
  SELECT id INTO v_capital_account_id
  FROM public.chart_of_accounts
  WHERE code = '3100' AND account_type = 'equity' AND is_active = true;

  IF v_capital_account_id IS NULL THEN
    RAISE EXCEPTION 'Owner Capital account (3100) not found';
  END IF;

  -- Compute period month (first day of the month)
  v_period_month := date_trunc('month', v_today)::date;

  -- Ensure financial period exists (and is not closed)
  PERFORM public.ensure_financial_period(v_today);

  -- Build voucher number
  v_voucher := 'OB-' || to_char(now() AT TIME ZONE 'Africa/Cairo', 'YYYYMMDDHH24MISS');

  -- Create the journal entry header (posted, source=manual)
  INSERT INTO public.journal_entries (
    voucher_no, entry_date, source, status, description, description_ar,
    created_by, posted_by, posted_at, financial_period_month,
    total_debit, total_credit
  ) VALUES (
    v_voucher,
    v_today,
    'manual',
    'posted',
    COALESCE(p_notes, 'Opening balance for ' || v_account_name),
    COALESCE(p_notes, 'رصيد افتتاحي لحساب ' || v_account_name_ar),
    auth.uid(),
    auth.uid(),
    now(),
    v_period_month,
    p_amount,
    p_amount
  ) RETURNING id INTO v_entry_id;

  -- Debit cash account, Credit Owner Capital
  INSERT INTO public.journal_entry_lines (
    journal_entry_id, line_no, account_id, debit, credit, description, financial_period_month, posted_at
  ) VALUES
    (v_entry_id, 1, v_cash_account_id, p_amount, 0,
     'Opening balance - ' || v_account_name, v_period_month, now()),
    (v_entry_id, 2, v_capital_account_id, 0, p_amount,
     'Opening capital contribution', v_period_month, now());

  RETURN jsonb_build_object(
    'ok', true,
    'entry_id', v_entry_id,
    'voucher_no', v_voucher,
    'account_code', p_account_code,
    'amount', p_amount,
    'entry_date', v_today
  );
END;
$function$;

-- Restrict execution to authenticated users (admin check enforced inside the function)
REVOKE ALL ON FUNCTION public.record_treasury_opening_balance(text, numeric, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_treasury_opening_balance(text, numeric, date, text) TO authenticated;

COMMENT ON FUNCTION public.record_treasury_opening_balance IS
  'Records an opening cash balance for a treasury account. Creates a balanced journal: Debit Cash / Credit Owner Capital (3100). Does NOT affect revenue, expenses, or profit.';