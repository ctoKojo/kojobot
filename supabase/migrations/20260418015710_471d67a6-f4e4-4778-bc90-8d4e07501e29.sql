ALTER TABLE public.instructor_warnings_backup_20260418 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read warnings backup"
  ON public.instructor_warnings_backup_20260418 FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));