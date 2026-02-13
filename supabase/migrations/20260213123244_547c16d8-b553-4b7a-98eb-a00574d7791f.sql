
DROP POLICY IF EXISTS "Reception can insert notifications" ON public.notifications;

CREATE POLICY "Reception can notify students only"
ON public.notifications FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'reception'::app_role)
  AND is_student(user_id)
);
