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
  v_sources_enum journal_source_type[];
BEGIN
  IF v_actor IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_actor AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Only admins can purge journal entries';
    END IF;
  END IF;

  IF p_before_date IS NULL THEN
    RAISE EXCEPTION 'p_before_date is required';
  END IF;

  -- Cast text[] to enum[]
  SELECT array_agg(s::journal_source_type) INTO v_sources_enum
  FROM unnest(p_sources) AS s;

  PERFORM set_config('app.via_rpc', 'true', true);

  SELECT COUNT(*) INTO v_line_count
  FROM public.journal_entry_lines jel
  JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.source = ANY(v_sources_enum)
    AND je.entry_date < p_before_date;

  WITH deleted AS (
    DELETE FROM public.journal_entries
    WHERE source = ANY(v_sources_enum)
      AND entry_date < p_before_date
    RETURNING id
  )
  SELECT COUNT(*) INTO v_entry_count FROM deleted;

  RETURN QUERY SELECT v_entry_count, v_line_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_historical_journal_entries(date, text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.purge_historical_journal_entries(date, text[]) TO authenticated;

SELECT * FROM public.purge_historical_journal_entries('2026-04-01'::date, ARRAY['payment','expense']);

REFRESH MATERIALIZED VIEW public.mv_account_balances_monthly;