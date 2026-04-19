
-- Disable enforcement during DDL
ALTER TABLE public.payments DISABLE TRIGGER z_enforce_via_rpc;
ALTER TABLE public.expenses DISABLE TRIGGER z_enforce_via_rpc;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'salary_payments') THEN
    EXECUTE 'ALTER TABLE public.salary_payments DISABLE TRIGGER z_enforce_via_rpc';
  END IF;
END $$;

-- Give financial_period_month a default so TS sees it as optional in Insert
ALTER TABLE public.payments
  ALTER COLUMN financial_period_month SET DEFAULT date_trunc('month', CURRENT_DATE)::date;

ALTER TABLE public.expenses
  ALTER COLUMN financial_period_month SET DEFAULT date_trunc('month', CURRENT_DATE)::date;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'salary_payments') THEN
    EXECUTE 'ALTER TABLE public.salary_payments
             ALTER COLUMN financial_period_month SET DEFAULT date_trunc(''month'', CURRENT_DATE)::date';
  END IF;
END $$;

-- Re-enable
ALTER TABLE public.payments ENABLE TRIGGER z_enforce_via_rpc;
ALTER TABLE public.expenses ENABLE TRIGGER z_enforce_via_rpc;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'salary_payments') THEN
    EXECUTE 'ALTER TABLE public.salary_payments ENABLE TRIGGER z_enforce_via_rpc';
  END IF;
END $$;
