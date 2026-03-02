ALTER TABLE public.landing_plans ADD COLUMN price_before_discount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.landing_plans ADD COLUMN price_online_before_discount numeric NOT NULL DEFAULT 0;