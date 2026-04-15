
-- Drop the read-only policy for reception
DROP POLICY IF EXISTS "Reception can view quiz assignments" ON public.quiz_assignments;

-- Create full access policy for reception (matching admin pattern)
CREATE POLICY "Reception can manage quiz assignments"
ON public.quiz_assignments
FOR ALL
USING (has_role(auth.uid(), 'reception'::app_role))
WITH CHECK (has_role(auth.uid(), 'reception'::app_role));
