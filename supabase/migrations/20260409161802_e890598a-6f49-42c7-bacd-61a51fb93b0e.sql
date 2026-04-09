
-- Drop the old student-only policy
DROP POLICY IF EXISTS "Reception can view student roles" ON public.user_roles;

-- Replace with a policy that lets reception see both student AND instructor roles
CREATE POLICY "Reception can view student and instructor roles"
  ON public.user_roles FOR SELECT
  USING (
    has_role(auth.uid(), 'reception'::app_role)
    AND role IN ('student'::app_role, 'instructor'::app_role)
  );
