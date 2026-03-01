-- Fix instructor profile policy: restrict to students in their groups only
DROP POLICY IF EXISTS "Instructors can view student profiles in their groups" ON public.profiles;

CREATE POLICY "Instructors can view student profiles in their groups"
ON public.profiles FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'instructor'::app_role) AND
  EXISTS (
    SELECT 1 FROM group_students gs
    JOIN groups g ON g.id = gs.group_id
    WHERE gs.student_id = profiles.user_id
      AND g.instructor_id = auth.uid()
      AND gs.is_active = true
  )
);