CREATE POLICY "Reception can view student roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'reception'::app_role) 
  AND role = 'student'::app_role
);