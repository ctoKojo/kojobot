-- Add missing wrapper RPCs that the UI hooks expect
-- These wrap the existing per-type RPCs into a unified interface

CREATE OR REPLACE FUNCTION public.check_account_balance_integrity(
  p_account_type text,
  p_account_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cached numeric := 0;
  v_computed numeric := 0;
BEGIN
  IF p_account_type = 'customer' THEN
    SELECT cached_balance INTO v_cached
      FROM public.customer_accounts WHERE student_id = p_account_id;
    v_computed := public.compute_customer_balance(p_account_id);
  ELSIF p_account_type = 'employee' THEN
    SELECT cached_balance INTO v_cached
      FROM public.employee_accounts WHERE employee_id = p_account_id;
    v_computed := public.compute_employee_balance(p_account_id);
  ELSE
    RAISE EXCEPTION 'Invalid account_type: %', p_account_type;
  END IF;

  RETURN jsonb_build_object(
    'cached', COALESCE(v_cached, 0),
    'computed', COALESCE(v_computed, 0),
    'difference', COALESCE(v_computed, 0) - COALESCE(v_cached, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_account_balance(
  p_account_type text,
  p_account_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Mark RPC context (defense-in-depth)
  PERFORM set_config('app.via_rpc', 'true', true);

  IF p_account_type = 'customer' THEN
    v_result := public.rebuild_customer_balance(p_account_id);
  ELSIF p_account_type = 'employee' THEN
    v_result := public.rebuild_employee_balance(p_account_id);
  ELSE
    RAISE EXCEPTION 'Invalid account_type: %', p_account_type;
  END IF;

  RETURN COALESCE(v_result, jsonb_build_object('success', true));
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_account_balance_integrity(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_account_balance(text, uuid) TO authenticated;

-- Register in approved RPCs
INSERT INTO public.approved_financial_rpcs(rpc_name, description, version)
VALUES
  ('check_account_balance_integrity', 'Unified live integrity check for customer/employee accounts', 1),
  ('rebuild_account_balance', 'Unified rebuild dispatcher for customer/employee balance', 1)
ON CONFLICT (rpc_name) DO NOTHING;