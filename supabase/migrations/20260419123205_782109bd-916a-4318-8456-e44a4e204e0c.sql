
-- ============================================================
-- Phase 0: Foundation Hardening — 3-Layer RPC Enforcement
-- ============================================================

-- 1) Approved RPCs registry
CREATE TABLE IF NOT EXISTS public.approved_financial_rpcs (
  rpc_name text PRIMARY KEY,
  version int NOT NULL DEFAULT 1,
  description text,
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by uuid
);

ALTER TABLE public.approved_financial_rpcs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_view_approved_rpcs"
  ON public.approved_financial_rpcs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) Security violations log
CREATE TABLE IF NOT EXISTS public.security_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  violation_type text NOT NULL,
  table_name text NOT NULL,
  operation text NOT NULL,
  attempted_by_role text,
  attempted_by_user uuid,
  query_snippet text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_violations_created_at
  ON public.security_violations (created_at DESC);

ALTER TABLE public.security_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_view_security_violations"
  ON public.security_violations
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3) Helper: enforce_via_rpc — universal trigger function
CREATE OR REPLACE FUNCTION public.enforce_via_rpc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_via_rpc text;
  v_query text;
BEGIN
  v_via_rpc := current_setting('app.via_rpc', true);

  -- Layer B: session context guard
  IF v_via_rpc IS DISTINCT FROM 'true' THEN
    -- Layer C: try to extract calling query for forensics
    BEGIN
      v_query := left(current_query(), 500);
    EXCEPTION WHEN others THEN
      v_query := NULL;
    END;

    INSERT INTO public.security_violations (
      violation_type, table_name, operation,
      attempted_by_role, attempted_by_user, query_snippet,
      details
    ) VALUES (
      'DIRECT_DML_FORBIDDEN',
      TG_TABLE_NAME,
      TG_OP,
      current_user,
      auth.uid(),
      v_query,
      jsonb_build_object('schema', TG_TABLE_SCHEMA)
    );

    RAISE EXCEPTION
      'DIRECT_DML_FORBIDDEN: Table %.% can only be modified via approved RPC. Op=%',
      TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP
      USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4) Apply enforcement triggers to current financial tables
--    (more tables added in later phases as they're created)

-- payments
DROP TRIGGER IF EXISTS z_enforce_via_rpc ON public.payments;
CREATE TRIGGER z_enforce_via_rpc
  BEFORE INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_via_rpc();

-- expenses
DROP TRIGGER IF EXISTS z_enforce_via_rpc ON public.expenses;
CREATE TRIGGER z_enforce_via_rpc
  BEFORE INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_via_rpc();

-- 5) Helper for RPC implementations to mark session
CREATE OR REPLACE FUNCTION public.mark_via_rpc()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.via_rpc', 'true', true);
END;
$$;

-- 6) Helper to register an RPC in the approved registry
CREATE OR REPLACE FUNCTION public.register_financial_rpc(
  p_rpc_name text,
  p_version int DEFAULT 1,
  p_description text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.approved_financial_rpcs (rpc_name, version, description, added_by)
  VALUES (p_rpc_name, p_version, p_description, auth.uid())
  ON CONFLICT (rpc_name) DO UPDATE
    SET version = EXCLUDED.version,
        description = COALESCE(EXCLUDED.description, approved_financial_rpcs.description);
END;
$$;
