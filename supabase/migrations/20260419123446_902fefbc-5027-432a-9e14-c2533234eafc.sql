
-- ============================================================
-- Phase 1: Financial Periods + Payment Method ENUMs + Receipts
-- (retry — disable enforce_via_rpc during column backfill)
-- ============================================================

-- Disable RPC enforcement during this migration's backfill
ALTER TABLE public.payments DISABLE TRIGGER z_enforce_via_rpc;
ALTER TABLE public.expenses DISABLE TRIGGER z_enforce_via_rpc;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'salary_payments') THEN
    -- if trigger doesn't exist on salary_payments yet, this is a no-op (handled below)
    BEGIN
      EXECUTE 'ALTER TABLE public.salary_payments DISABLE TRIGGER z_enforce_via_rpc';
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
  END IF;
END $$;

-- 1) ENUMs
DO $$ BEGIN
  CREATE TYPE public.payment_method_type AS ENUM ('cash', 'transfer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.transfer_method_type AS ENUM ('bank', 'instapay', 'wallet');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.financial_period_status AS ENUM ('open', 'review', 'closed', 'reopened');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.receipt_status_type AS ENUM ('not_required', 'pending_receipt', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) financial_periods table
CREATE TABLE IF NOT EXISTS public.financial_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month date NOT NULL UNIQUE,
  status public.financial_period_status NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  review_started_at timestamptz,
  review_started_by uuid,
  closed_at timestamptz,
  closed_by uuid,
  reopened_at timestamptz,
  reopened_by uuid,
  reopen_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT period_month_first_day CHECK (period_month = date_trunc('month', period_month)::date)
);

CREATE INDEX IF NOT EXISTS idx_financial_periods_status
  ON public.financial_periods (status, period_month DESC);

ALTER TABLE public.financial_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_view_financial_periods" ON public.financial_periods;
CREATE POLICY "staff_view_financial_periods"
  ON public.financial_periods
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'reception')
  );

-- 3) ensure_financial_period
CREATE OR REPLACE FUNCTION public.ensure_financial_period(p_date date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', p_date)::date;
  v_id uuid;
BEGIN
  INSERT INTO public.financial_periods (period_month)
  VALUES (v_month)
  ON CONFLICT (period_month) DO NOTHING;

  SELECT id INTO v_id FROM public.financial_periods WHERE period_month = v_month;
  RETURN v_id;
END;
$$;

-- 4) is_period_writable
CREATE OR REPLACE FUNCTION public.is_period_writable(p_date date)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', p_date)::date;
  v_status public.financial_period_status;
BEGIN
  SELECT status INTO v_status
  FROM public.financial_periods
  WHERE period_month = v_month;

  IF v_status IS NULL THEN
    RETURN true;
  END IF;

  RETURN v_status IN ('open', 'reopened');
END;
$$;

-- 5) payments columns + backfill
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_method public.payment_method_type NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS transfer_type public.transfer_method_type,
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS receipt_status public.receipt_status_type NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS financial_period_month date;

UPDATE public.payments
SET financial_period_month = date_trunc('month', COALESCE(payment_date, created_at))::date
WHERE financial_period_month IS NULL;

ALTER TABLE public.payments
  ALTER COLUMN financial_period_month SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_period_month
  ON public.payments (financial_period_month);

-- 6) expenses columns + backfill
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS payment_method public.payment_method_type NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS transfer_type public.transfer_method_type,
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS receipt_status public.receipt_status_type NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS financial_period_month date;

UPDATE public.expenses
SET financial_period_month = date_trunc('month', COALESCE(expense_date, created_at))::date
WHERE financial_period_month IS NULL;

ALTER TABLE public.expenses
  ALTER COLUMN financial_period_month SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_period_month
  ON public.expenses (financial_period_month);

-- 7) salary_payments columns + backfill (if exists)
DO $$
DECLARE
  v_has_payment_date boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'salary_payments') THEN

    EXECUTE '
      ALTER TABLE public.salary_payments
        ADD COLUMN IF NOT EXISTS payment_method public.payment_method_type NOT NULL DEFAULT ''cash'',
        ADD COLUMN IF NOT EXISTS transfer_type public.transfer_method_type,
        ADD COLUMN IF NOT EXISTS receipt_url text,
        ADD COLUMN IF NOT EXISTS receipt_status public.receipt_status_type NOT NULL DEFAULT ''not_required'',
        ADD COLUMN IF NOT EXISTS financial_period_month date;
    ';

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'salary_payments' AND column_name = 'payment_date'
    ) INTO v_has_payment_date;

    IF v_has_payment_date THEN
      EXECUTE 'UPDATE public.salary_payments
               SET financial_period_month = date_trunc(''month'', COALESCE(payment_date, created_at))::date
               WHERE financial_period_month IS NULL';
    ELSE
      EXECUTE 'UPDATE public.salary_payments
               SET financial_period_month = date_trunc(''month'', created_at)::date
               WHERE financial_period_month IS NULL';
    END IF;

    EXECUTE 'ALTER TABLE public.salary_payments
             ALTER COLUMN financial_period_month SET NOT NULL';

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_salary_payments_period_month
             ON public.salary_payments (financial_period_month)';
  END IF;
END $$;

-- 8) Validation trigger
CREATE OR REPLACE FUNCTION public.validate_payment_method_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_method = 'cash' THEN
    IF NEW.transfer_type IS NOT NULL THEN
      RAISE EXCEPTION 'PAYMENT_VALIDATION: cash payments must not have transfer_type'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.receipt_url IS NOT NULL THEN
      RAISE EXCEPTION 'PAYMENT_VALIDATION: cash payments must not have receipt_url'
        USING ERRCODE = '23514';
    END IF;
    NEW.receipt_status := 'not_required';
  ELSIF NEW.payment_method = 'transfer' THEN
    IF NEW.transfer_type IS NULL THEN
      RAISE EXCEPTION 'PAYMENT_VALIDATION: transfer payments require transfer_type'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.receipt_url IS NULL THEN
      NEW.receipt_status := 'pending_receipt';
    ELSE
      NEW.receipt_status := 'completed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_validate_payment_method ON public.payments;
CREATE TRIGGER a_validate_payment_method
  BEFORE INSERT OR UPDATE OF payment_method, transfer_type, receipt_url ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.validate_payment_method_consistency();

DROP TRIGGER IF EXISTS a_validate_payment_method ON public.expenses;
CREATE TRIGGER a_validate_payment_method
  BEFORE INSERT OR UPDATE OF payment_method, transfer_type, receipt_url ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.validate_payment_method_consistency();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'salary_payments') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS a_validate_payment_method ON public.salary_payments';
    EXECUTE 'CREATE TRIGGER a_validate_payment_method
             BEFORE INSERT OR UPDATE OF payment_method, transfer_type, receipt_url ON public.salary_payments
             FOR EACH ROW EXECUTE FUNCTION public.validate_payment_method_consistency()';
  END IF;
END $$;

-- 9) Auto-set financial_period_month + writability check
CREATE OR REPLACE FUNCTION public.set_and_check_financial_period()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_date date;
BEGIN
  IF TG_TABLE_NAME = 'payments' THEN
    v_event_date := COALESCE(NEW.payment_date, CURRENT_DATE);
  ELSIF TG_TABLE_NAME = 'expenses' THEN
    v_event_date := COALESCE(NEW.expense_date, CURRENT_DATE);
  ELSE
    v_event_date := CURRENT_DATE;
  END IF;

  IF NEW.financial_period_month IS NULL THEN
    NEW.financial_period_month := date_trunc('month', v_event_date)::date;
  END IF;

  PERFORM public.ensure_financial_period(NEW.financial_period_month);

  IF TG_OP IN ('INSERT','UPDATE') THEN
    IF NOT public.is_period_writable(NEW.financial_period_month) THEN
      RAISE EXCEPTION
        'PERIOD_LOCKED: Cannot write to financial period % (status not open/reopened)',
        NEW.financial_period_month
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS b_set_financial_period ON public.payments;
CREATE TRIGGER b_set_financial_period
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_and_check_financial_period();

DROP TRIGGER IF EXISTS b_set_financial_period ON public.expenses;
CREATE TRIGGER b_set_financial_period
  BEFORE INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_and_check_financial_period();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'salary_payments') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS b_set_financial_period ON public.salary_payments';
    EXECUTE 'CREATE TRIGGER b_set_financial_period
             BEFORE INSERT OR UPDATE ON public.salary_payments
             FOR EACH ROW EXECUTE FUNCTION public.set_and_check_financial_period()';
  END IF;
END $$;

-- 10) updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_financial_period_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_updated_at ON public.financial_periods;
CREATE TRIGGER touch_updated_at
  BEFORE UPDATE ON public.financial_periods
  FOR EACH ROW EXECUTE FUNCTION public.touch_financial_period_updated_at();

-- 11) Storage: payment-receipts bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "staff_read_payment_receipts" ON storage.objects;
CREATE POLICY "staff_read_payment_receipts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'reception')
    )
  );

DROP POLICY IF EXISTS "staff_upload_payment_receipts" ON storage.objects;
CREATE POLICY "staff_upload_payment_receipts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-receipts'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'reception')
    )
  );

DROP POLICY IF EXISTS "staff_delete_payment_receipts" ON storage.objects;
CREATE POLICY "staff_delete_payment_receipts"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND public.has_role(auth.uid(), 'admin')
  );

-- 12) Owner (parent/student) read access via helper
CREATE OR REPLACE FUNCTION public.can_view_payment_receipt(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_id uuid;
  v_student_id uuid;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN false; END IF;

  IF p_object_name LIKE 'payments/%' THEN
    BEGIN
      v_payment_id := split_part(p_object_name, '/', 2)::uuid;
    EXCEPTION WHEN others THEN
      RETURN false;
    END;

    SELECT s.student_id INTO v_student_id
    FROM public.payments p
    JOIN public.subscriptions s ON s.id = p.subscription_id
    WHERE p.id = v_payment_id;

    IF v_student_id IS NULL THEN RETURN false; END IF;

    IF EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.user_id = v_user AND pr.id = v_student_id
    ) THEN
      RETURN true;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.parent_students ps
      JOIN public.profiles pr ON pr.id = ps.parent_id
      WHERE pr.user_id = v_user AND ps.student_id = v_student_id
    ) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

DROP POLICY IF EXISTS "owner_read_payment_receipts" ON storage.objects;
CREATE POLICY "owner_read_payment_receipts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND public.can_view_payment_receipt(name)
  );

-- Re-enable RPC enforcement after migration backfill
ALTER TABLE public.payments ENABLE TRIGGER z_enforce_via_rpc;
ALTER TABLE public.expenses ENABLE TRIGGER z_enforce_via_rpc;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'salary_payments') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS z_enforce_via_rpc ON public.salary_payments';
    EXECUTE 'CREATE TRIGGER z_enforce_via_rpc
             BEFORE INSERT OR UPDATE OR DELETE ON public.salary_payments
             FOR EACH ROW EXECUTE FUNCTION public.enforce_via_rpc()';
  END IF;
END $$;
