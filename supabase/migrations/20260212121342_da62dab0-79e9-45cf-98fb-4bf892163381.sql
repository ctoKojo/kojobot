
-- 1. Expenses table
CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL DEFAULT 'other',
  description text NOT NULL,
  description_ar text,
  amount numeric NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  is_recurring boolean NOT NULL DEFAULT false,
  recorded_by uuid NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage expenses" ON public.expenses FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Employee salaries table
CREATE TABLE public.employee_salaries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL,
  employee_type text NOT NULL DEFAULT 'instructor',
  base_salary numeric NOT NULL,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_salaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage employee salaries" ON public.employee_salaries FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Employees can view their own salary" ON public.employee_salaries FOR SELECT USING (employee_id = auth.uid());

-- 3. Salary payments table
CREATE TABLE public.salary_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL,
  salary_id uuid REFERENCES public.employee_salaries(id),
  month date NOT NULL,
  base_amount numeric NOT NULL DEFAULT 0,
  deductions numeric NOT NULL DEFAULT 0,
  bonus numeric NOT NULL DEFAULT 0,
  net_amount numeric GENERATED ALWAYS AS (base_amount - deductions + bonus) STORED,
  deduction_reason text,
  deduction_reason_ar text,
  bonus_reason text,
  bonus_reason_ar text,
  status text NOT NULL DEFAULT 'pending',
  paid_date date,
  paid_by uuid,
  payment_method text DEFAULT 'cash',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage salary payments" ON public.salary_payments FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Employees can view their own payments" ON public.salary_payments FOR SELECT USING (employee_id = auth.uid());

-- Trigger for updated_at on employee_salaries
CREATE TRIGGER update_employee_salaries_updated_at
  BEFORE UPDATE ON public.employee_salaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
