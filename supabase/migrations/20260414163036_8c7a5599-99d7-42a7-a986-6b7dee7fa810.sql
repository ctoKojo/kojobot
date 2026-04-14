CREATE POLICY "Reception full access to gsp"
ON public.group_student_progress
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'reception'::app_role))
WITH CHECK (has_role(auth.uid(), 'reception'::app_role));