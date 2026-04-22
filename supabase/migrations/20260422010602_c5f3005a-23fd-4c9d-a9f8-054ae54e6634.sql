CREATE OR REPLACE FUNCTION public.purge_historical_journal_entries(
  p_before_date date,
  p_sources text[] DEFAULT ARRAY['payment','expense']
)
RETURNS TABLE(deleted_entries integer, deleted_lines integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_entry_count integer := 0;
  v_line_count integer := 0;
  v_actor uuid := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_actor AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can purge journal entries';
  END IF;

  IF p_before_date IS NULL THEN
    RAISE EXCEPTION 'p_before_date is required';
  END IF;

  SELECT COUNT(*) INTO v_line_count
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.source = ANY(p_sources)
    AND je.entry_date < p_before_date;

  WITH deleted AS (
    DELETE FROM public.journal_entries
    WHERE source = ANY(p_sources)
      AND entry_date < p_before_date
    RETURNING id
  )
  SELECT COUNT(*) INTO v_entry_count FROM deleted;

  PERFORM public.log_financial_action(
    p_action := 'purge_historical_journal',
    p_entity_type := 'journal_entries',
    p_entity_id := gen_random_uuid(),
    p_amount := NULL,
    p_currency := 'EGP',
    p_period_month := NULL,
    p_details := jsonb_build_object(
      'before_date', p_before_date,
      'sources', p_sources,
      'deleted_entries', v_entry_count,
      'deleted_lines', v_line_count
    ),
    p_source_rpc := 'purge_historical_journal_entries'
  );

  RETURN QUERY SELECT v_entry_count, v_line_count;
END;
$$;

INSERT INTO public.approved_financial_rpcs (rpc_name, description, version)
VALUES (
  'purge_historical_journal_entries',
  'Admin-only: deletes historical journal entries before a given date for specified sources (payment/expense). Used for treasury reset.',
  1
)
ON CONFLICT (rpc_name) DO UPDATE
  SET description = EXCLUDED.description,
      version = public.approved_financial_rpcs.version + 1;

REVOKE ALL ON FUNCTION public.purge_historical_journal_entries(date, text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.purge_historical_journal_entries(date, text[]) TO authenticated;