-- Fix the instructor policy on group_students to avoid recursion
DROP POLICY IF EXISTS "Instructors can view their group students" ON public.group_students;

-- Recreate without circular dependency - use a direct subquery
CREATE POLICY "Instructors can view their group students"
ON public.group_students
FOR SELECT
USING (
  public.has_role(auth.uid(), 'instructor'::app_role) 
  AND group_id IN (
    SELECT g.id FROM public.groups g WHERE g.instructor_id = auth.uid()
  )
);