-- Allow instructors to insert their own staff attendance records (for auto-attendance)
CREATE POLICY "Instructors can insert their session attendance"
ON public.session_staff_attendance
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'instructor'::app_role)
  AND staff_id = auth.uid()
  AND session_id IN (
    SELECT s.id FROM sessions s
    WHERE s.group_id IN (SELECT get_instructor_group_ids(auth.uid()))
  )
);