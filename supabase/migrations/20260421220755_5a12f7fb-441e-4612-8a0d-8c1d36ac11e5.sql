-- Allow admins and reception to read the email send log for monitoring
CREATE POLICY "Admins and reception can read send log"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'reception'::app_role)
);