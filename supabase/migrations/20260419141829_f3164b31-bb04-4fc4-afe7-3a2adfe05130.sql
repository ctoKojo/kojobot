-- ============================================================
-- GAP 2: SNAPSHOT ROUTER DB-LEVEL ENFORCEMENT
-- Defense-in-depth: registry + session guard + scanner
-- ============================================================

-- 1. Reporting RPC registry
CREATE TABLE IF NOT EXISTS public.reporting_rpcs_registry (
  rpc_name text PRIMARY KEY,
  must_use_router boolean NOT NULL DEFAULT true,
  description text,
  registered_by uuid,
  registered_at timestamptz NOT NULL DEFAULT now(),
  last_compliance_check timestamptz,
  last_compliance_status text
);

ALTER TABLE public.reporting_rpcs_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_view_reporting_registry"
  ON public.reporting_rpcs_registry FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Session-context guard — first line of every reporting RPC
CREATE OR REPLACE FUNCTION public.assert_report_via_router(p_period_month date DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_via_router text;
BEGIN
  v_via_router := current_setting('app.via_report_router', true);
  IF v_via_router IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'REPORT_ROUTER_BYPASS: Reporting RPCs must be invoked via fetch_from_snapshot_or_compute() (period: %)', p_period_month
      USING HINT = 'Call public.fetch_from_snapshot_or_compute(...) instead of the underlying reporting function directly.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_report_via_router(date) TO authenticated;

-- 3. Compliance scanner — checks registered RPCs use the router helper in their source
CREATE OR REPLACE FUNCTION public.enforce_router_usage()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rpc record;
  v_src text;
  v_violations jsonb := '[]'::jsonb;
  v_compliant int := 0;
  v_violating int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  FOR v_rpc IN
    SELECT rpc_name FROM public.reporting_rpcs_registry WHERE must_use_router = true
  LOOP
    SELECT prosrc INTO v_src
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = v_rpc.rpc_name
     LIMIT 1;

    IF v_src IS NULL THEN
      v_violations := v_violations || jsonb_build_object(
        'rpc', v_rpc.rpc_name, 'issue', 'function_not_found'
      );
      v_violating := v_violating + 1;
    ELSIF v_src !~ '(assert_report_via_router|fetch_from_snapshot_or_compute|get_report_source)' THEN
      v_violations := v_violations || jsonb_build_object(
        'rpc', v_rpc.rpc_name, 'issue', 'router_helpers_not_referenced'
      );
      v_violating := v_violating + 1;

      UPDATE public.reporting_rpcs_registry
        SET last_compliance_check = now(), last_compliance_status = 'violating'
        WHERE rpc_name = v_rpc.rpc_name;
    ELSE
      v_compliant := v_compliant + 1;
      UPDATE public.reporting_rpcs_registry
        SET last_compliance_check = now(), last_compliance_status = 'compliant'
        WHERE rpc_name = v_rpc.rpc_name;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'scanned_at', now(),
    'compliant_count', v_compliant,
    'violating_count', v_violating,
    'violations', v_violations
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.enforce_router_usage() TO authenticated;

-- 4. Daily compliance scan wrapper (callable by cron)
CREATE OR REPLACE FUNCTION public.scan_reporting_compliance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Bypass the admin check by inlining the scan logic here for cron invocation
  WITH scanned AS (
    SELECT
      r.rpc_name,
      p.prosrc IS NOT NULL AS exists,
      COALESCE(p.prosrc ~ '(assert_report_via_router|fetch_from_snapshot_or_compute|get_report_source)', false) AS uses_router
    FROM public.reporting_rpcs_registry r
    LEFT JOIN pg_proc p ON p.proname = r.rpc_name
    LEFT JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    WHERE r.must_use_router = true
  )
  SELECT jsonb_build_object(
    'scanned_at', now(),
    'total', COUNT(*),
    'compliant', COUNT(*) FILTER (WHERE exists AND uses_router),
    'violating', COUNT(*) FILTER (WHERE NOT exists OR NOT uses_router),
    'violations', COALESCE(jsonb_agg(
        jsonb_build_object('rpc', rpc_name, 'exists', exists, 'uses_router', uses_router)
      ) FILTER (WHERE NOT exists OR NOT uses_router), '[]'::jsonb)
  ) INTO v_result
  FROM scanned;

  -- Update registry
  UPDATE public.reporting_rpcs_registry r
     SET last_compliance_check = now(),
         last_compliance_status = CASE
           WHEN EXISTS (
             SELECT 1 FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname='public' AND p.proname = r.rpc_name
               AND p.prosrc ~ '(assert_report_via_router|fetch_from_snapshot_or_compute|get_report_source)'
           ) THEN 'compliant' ELSE 'violating' END
   WHERE must_use_router = true;

  -- Persist alert for violations
  IF (v_result->>'violating')::int > 0 THEN
    INSERT INTO public.data_quality_issues(entity_table, entity_id, issue_type, details, status)
    VALUES ('reporting_rpcs_registry', gen_random_uuid(), 'reporting_router_bypass',
            v_result, 'open')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_result;
EXCEPTION WHEN undefined_column OR undefined_object THEN
  -- data_quality_issues schema or enum may not include the new value yet — fall back silently
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.scan_reporting_compliance() TO authenticated;

-- 5. Register the 4 core reporting RPCs
INSERT INTO public.reporting_rpcs_registry(rpc_name, must_use_router, description) VALUES
  ('get_trial_balance',         true, 'Trial balance — must route via snapshot/live router'),
  ('get_income_statement',      true, 'Income statement — must route via snapshot/live router'),
  ('get_balance_sheet',         true, 'Balance sheet — must route via snapshot/live router'),
  ('get_cash_flow_statement',   true, 'Cash flow — must route via snapshot/live router')
ON CONFLICT (rpc_name) DO NOTHING;

-- 6. Wrap each report so direct calls without router context are blocked
-- (re-issue with assert_report_via_router as first line; preserves original signature)

CREATE OR REPLACE FUNCTION public.get_trial_balance(p_period_month date DEFAULT NULL)
RETURNS TABLE(
  account_code text,
  account_name text,
  account_name_ar text,
  account_type account_type,
  total_debit numeric,
  total_credit numeric,
  net_balance numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_report_via_router(p_period_month);

  RETURN QUERY
  SELECT
    coa.code,
    coa.name,
    coa.name_ar,
    coa.account_type,
    COALESCE(SUM(jel.debit), 0)::numeric AS total_debit,
    COALESCE(SUM(jel.credit), 0)::numeric AS total_credit,
    CASE
      WHEN coa.normal_side = 'debit' THEN COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)
      ELSE COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0)
    END::numeric AS net_balance
  FROM public.chart_of_accounts coa
  LEFT JOIN public.journal_entry_lines jel ON jel.account_id = coa.id
  LEFT JOIN public.journal_entries je ON je.id = jel.entry_id
   AND je.status = 'posted'
   AND (p_period_month IS NULL OR date_trunc('month', je.entry_date)::date = date_trunc('month', p_period_month)::date)
  WHERE coa.is_active = true
  GROUP BY coa.id, coa.code, coa.name, coa.name_ar, coa.account_type, coa.normal_side
  ORDER BY coa.code;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_income_statement(p_period_month date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_revenue numeric := 0;
  v_expenses numeric := 0;
  v_salaries numeric := 0;
BEGIN
  PERFORM public.assert_report_via_router(p_period_month);

  SELECT COALESCE(SUM(jel.credit - jel.debit), 0) INTO v_revenue
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.entry_id
    JOIN public.chart_of_accounts coa ON coa.id = jel.account_id
   WHERE je.status='posted'
     AND coa.account_type='revenue'
     AND date_trunc('month', je.entry_date)::date = date_trunc('month', p_period_month)::date;

  SELECT COALESCE(SUM(jel.debit - jel.credit), 0) INTO v_expenses
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.entry_id
    JOIN public.chart_of_accounts coa ON coa.id = jel.account_id
   WHERE je.status='posted'
     AND coa.account_type='expense'
     AND coa.code NOT LIKE '5100%' -- exclude salary expense (tracked separately)
     AND date_trunc('month', je.entry_date)::date = date_trunc('month', p_period_month)::date;

  SELECT COALESCE(SUM(jel.debit - jel.credit), 0) INTO v_salaries
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.entry_id
    JOIN public.chart_of_accounts coa ON coa.id = jel.account_id
   WHERE je.status='posted'
     AND coa.code LIKE '5100%'
     AND date_trunc('month', je.entry_date)::date = date_trunc('month', p_period_month)::date;

  RETURN jsonb_build_object(
    'period_month', p_period_month,
    'total_revenue', v_revenue,
    'total_expenses', v_expenses,
    'total_salaries', v_salaries,
    'net_profit', v_revenue - v_expenses - v_salaries
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_balance_sheet(p_as_of_date date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assets numeric := 0;
  v_liabilities numeric := 0;
  v_equity numeric := 0;
BEGIN
  PERFORM public.assert_report_via_router(p_as_of_date);

  SELECT COALESCE(SUM(jel.debit - jel.credit), 0) INTO v_assets
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.entry_id
    JOIN public.chart_of_accounts coa ON coa.id = jel.account_id
   WHERE je.status='posted' AND coa.account_type='asset'
     AND je.entry_date <= p_as_of_date;

  SELECT COALESCE(SUM(jel.credit - jel.debit), 0) INTO v_liabilities
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.entry_id
    JOIN public.chart_of_accounts coa ON coa.id = jel.account_id
   WHERE je.status='posted' AND coa.account_type='liability'
     AND je.entry_date <= p_as_of_date;

  SELECT COALESCE(SUM(jel.credit - jel.debit), 0) INTO v_equity
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.entry_id
    JOIN public.chart_of_accounts coa ON coa.id = jel.account_id
   WHERE je.status='posted' AND coa.account_type='equity'
     AND je.entry_date <= p_as_of_date;

  RETURN jsonb_build_object(
    'as_of_date', p_as_of_date,
    'total_assets', v_assets,
    'total_liabilities', v_liabilities,
    'total_equity', v_equity,
    'balanced', abs(v_assets - (v_liabilities + v_equity)) < 0.01
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_cash_flow_statement(p_period_month date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inflow numeric := 0;
  v_outflow numeric := 0;
BEGIN
  PERFORM public.assert_report_via_router(p_period_month);

  SELECT COALESCE(SUM(jel.debit), 0) INTO v_inflow
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.entry_id
    JOIN public.chart_of_accounts coa ON coa.id = jel.account_id
   WHERE je.status='posted'
     AND coa.code LIKE '11%' -- cash & bank accounts
     AND date_trunc('month', je.entry_date)::date = date_trunc('month', p_period_month)::date;

  SELECT COALESCE(SUM(jel.credit), 0) INTO v_outflow
    FROM public.journal_entry_lines jel
    JOIN public.journal_entries je ON je.id = jel.entry_id
    JOIN public.chart_of_accounts coa ON coa.id = jel.account_id
   WHERE je.status='posted'
     AND coa.code LIKE '11%'
     AND date_trunc('month', je.entry_date)::date = date_trunc('month', p_period_month)::date;

  RETURN jsonb_build_object(
    'period_month', p_period_month,
    'cash_inflow', v_inflow,
    'cash_outflow', v_outflow,
    'net_cash_flow', v_inflow - v_outflow
  );
END;
$$;

-- 7. DDL event trigger — warn on new report-like function not registered
CREATE OR REPLACE FUNCTION public.warn_unregistered_reporting_rpc()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
DECLARE
  obj record;
  v_proname text;
BEGIN
  FOR obj IN
    SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE FUNCTION','ALTER FUNCTION')
      AND schema_name = 'public'
  LOOP
    SELECT p.proname INTO v_proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.oid = obj.objid AND n.nspname='public';

    IF v_proname IS NOT NULL
       AND (v_proname ILIKE 'get_%report%' OR v_proname ILIKE 'get_%balance%' OR v_proname ILIKE 'get_%statement%')
       AND NOT EXISTS (SELECT 1 FROM public.reporting_rpcs_registry WHERE rpc_name = v_proname)
    THEN
      RAISE WARNING 'UNREGISTERED_REPORTING_RPC: Function "%" looks like a reporting RPC but is not in reporting_rpcs_registry. Add it or it will not be enforced.', v_proname;
    END IF;
  END LOOP;
END;
$$;

DROP EVENT TRIGGER IF EXISTS warn_unregistered_reporting_rpc_trg;
CREATE EVENT TRIGGER warn_unregistered_reporting_rpc_trg
  ON ddl_command_end
  WHEN TAG IN ('CREATE FUNCTION','ALTER FUNCTION')
  EXECUTE FUNCTION public.warn_unregistered_reporting_rpc();