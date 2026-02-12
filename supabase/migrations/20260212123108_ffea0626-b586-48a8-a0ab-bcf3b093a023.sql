
-- Create warning deduction rules table
CREATE TABLE public.warning_deduction_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  warning_type TEXT NOT NULL,
  warning_count INTEGER NOT NULL DEFAULT 1,
  deduction_amount NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(warning_type, warning_count)
);

-- Enable RLS
ALTER TABLE public.warning_deduction_rules ENABLE ROW LEVEL SECURITY;

-- Only admins can manage
CREATE POLICY "Admins can manage warning deduction rules"
  ON public.warning_deduction_rules FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated can view
CREATE POLICY "Authenticated users can view warning deduction rules"
  ON public.warning_deduction_rules FOR SELECT
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_warning_deduction_rules_updated_at
  BEFORE UPDATE ON public.warning_deduction_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
