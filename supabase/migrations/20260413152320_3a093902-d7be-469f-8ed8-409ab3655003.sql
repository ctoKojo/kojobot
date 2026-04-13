
DROP POLICY "Admin can delete parent_students" ON public.parent_students;

CREATE POLICY "Admin and reception can delete parent_students"
  ON public.parent_students FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reception'));
