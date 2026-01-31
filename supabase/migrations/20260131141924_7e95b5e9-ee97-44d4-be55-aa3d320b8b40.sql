-- Drop existing problematic policies on groups
DROP POLICY IF EXISTS "Admins can manage groups" ON public.groups;
DROP POLICY IF EXISTS "Instructors can view their groups" ON public.groups;
DROP POLICY IF EXISTS "Students can view their groups" ON public.groups;

-- Recreate policies without recursion
CREATE POLICY "Admins can manage groups"
ON public.groups
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors can view their groups"
ON public.groups
FOR SELECT
USING (public.has_role(auth.uid(), 'instructor'::app_role) AND instructor_id = auth.uid());

-- Fix students policy - use a subquery that doesn't reference groups
CREATE POLICY "Students can view their groups"
ON public.groups
FOR SELECT
USING (
  public.has_role(auth.uid(), 'student'::app_role) 
  AND id IN (
    SELECT gs.group_id FROM public.group_students gs WHERE gs.student_id = auth.uid()
  )
);