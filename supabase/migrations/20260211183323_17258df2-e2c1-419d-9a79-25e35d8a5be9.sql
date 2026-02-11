
-- 1. Create pricing_plans table
CREATE TABLE public.pricing_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  name_ar text NOT NULL,
  attendance_mode text NOT NULL DEFAULT 'offline',
  group_type public.group_type NOT NULL,
  min_students integer NOT NULL DEFAULT 1,
  max_students integer NOT NULL DEFAULT 8,
  price_before_discount numeric NOT NULL,
  discount_percentage numeric NOT NULL DEFAULT 0,
  price_3_months numeric NOT NULL,
  price_1_month numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;

-- Everyone can view pricing plans
CREATE POLICY "Authenticated users can view pricing plans"
ON public.pricing_plans FOR SELECT
USING (true);

-- Only admins can manage
CREATE POLICY "Admins can insert pricing plans"
ON public.pricing_plans FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update pricing plans"
ON public.pricing_plans FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pricing plans"
ON public.pricing_plans FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_pricing_plans_updated_at
BEFORE UPDATE ON public.pricing_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Alter subscriptions table - add new columns
ALTER TABLE public.subscriptions
  ADD COLUMN pricing_plan_id uuid REFERENCES public.pricing_plans(id),
  ADD COLUMN payment_type text NOT NULL DEFAULT 'full',
  ADD COLUMN installment_amount numeric,
  ADD COLUMN next_payment_date date,
  ADD COLUMN is_suspended boolean NOT NULL DEFAULT false;

-- 3. Create payments table
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  amount numeric NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL DEFAULT 'cash',
  payment_type text NOT NULL DEFAULT 'regular',
  notes text,
  recorded_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Admins can manage all payments
CREATE POLICY "Admins can manage payments"
ON public.payments FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Students can view their own payments
CREATE POLICY "Students can view their payments"
ON public.payments FOR SELECT
USING (has_role(auth.uid(), 'student'::app_role) AND student_id = auth.uid());

-- 4. Insert initial pricing data
INSERT INTO public.pricing_plans (name, name_ar, attendance_mode, group_type, min_students, max_students, price_before_discount, discount_percentage, price_3_months, price_1_month) VALUES
('Kojo Squad', 'كوجو سكواد', 'offline', 'kojo_squad', 6, 8, 4000, 40, 2500, 1000),
('Kojo Core', 'كوجو كور', 'offline', 'kojo_core', 2, 3, 6500, 30, 4500, 1800),
('Kojo X', 'كوجو إكس', 'offline', 'kojo_x', 1, 1, 7500, 35, 5000, 2200),
('Kojo Squad', 'كوجو سكواد', 'online', 'kojo_squad', 6, 8, 3750, 45, 2000, 850),
('Kojo X', 'كوجو إكس', 'online', 'kojo_x', 1, 1, 4200, 50, 2100, 1400);
