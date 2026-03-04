
-- 1. Add slug column to landing_plans
ALTER TABLE public.landing_plans ADD COLUMN slug TEXT UNIQUE;

-- Set slugs using exact IDs
UPDATE public.landing_plans SET slug = 'kojo-squad' WHERE id = '06b29a34-2990-447a-bf17-adffe4cf2a96';
UPDATE public.landing_plans SET slug = 'kojo-core' WHERE id = 'fb30eb4a-9daf-49f4-af6f-9128e3a7cbcd';
UPDATE public.landing_plans SET slug = 'kojo-x' WHERE id = 'ee6cae8d-db0a-44c2-8ffa-8793b6b724c9';

ALTER TABLE public.landing_plans ALTER COLUMN slug SET NOT NULL;

-- 2. Create subscription_requests table (plan_id only, no plan_slug duplication)
CREATE TABLE public.subscription_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  plan_id UUID REFERENCES public.landing_plans(id),
  attendance_mode TEXT NOT NULL DEFAULT 'offline' CHECK (attendance_mode IN ('online', 'offline')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'closed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. RLS
ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;

-- No anon SELECT/UPDATE - only admin can read/update
CREATE POLICY "admin_select_subscription_requests"
  ON public.subscription_requests
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin_update_subscription_requests"
  ON public.subscription_requests
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Anon insert handled via edge function (no direct anon insert policy)

-- 4. Indexes
CREATE INDEX idx_subscription_requests_status ON public.subscription_requests(status);
CREATE INDEX idx_subscription_requests_created_at ON public.subscription_requests(created_at DESC);
CREATE INDEX idx_subscription_requests_email ON public.subscription_requests(email);
