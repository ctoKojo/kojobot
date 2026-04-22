DO $$
DECLARE
  r record;
  v_count integer := 0;
  v_updated integer := 0;
BEGIN
  -- Allow direct DML from this server-side context
  PERFORM set_config('app.via_rpc', 'true', true);

  -- 1) Set transfer_type = 'instapay' for the 5 missing April transfers
  UPDATE public.payments
  SET transfer_type = 'instapay'
  WHERE payment_date >= '2026-04-01'
    AND payment_date < '2026-05-01'
    AND payment_method = 'transfer'
    AND transfer_type IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % payments with transfer_type=instapay', v_updated;

  -- 2) Backfill journal entries for any April payment without one
  FOR r IN
    SELECT p.id
    FROM public.payments p
    WHERE p.payment_date >= '2026-04-01'
      AND p.payment_date < '2026-05-01'
      AND NOT EXISTS (
        SELECT 1 FROM public.journal_entries je
        WHERE je.source = 'payment'::journal_source_type
          AND je.source_id = p.id
      )
  LOOP
    BEGIN
      PERFORM public.post_payment_journal(r.id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped payment %: %', r.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Backfilled % journal entries', v_count;
END $$;

REFRESH MATERIALIZED VIEW public.mv_account_balances_monthly;