DROP POLICY IF EXISTS "Reception can view student and instructor roles" ON public.user_roles;

CREATE POLICY "Reception can view student instructor and parent roles"
ON public.user_roles
FOR SELECT
USING (
  has_role(auth.uid(), 'reception'::app_role)
  AND role = ANY (ARRAY['student'::app_role, 'instructor'::app_role, 'parent'::app_role])
);