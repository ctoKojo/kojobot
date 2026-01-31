-- Create helper function to get instructor's group ids without RLS check
CREATE OR REPLACE FUNCTION public.get_instructor_group_ids(_instructor_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.groups WHERE instructor_id = _instructor_id
$$;

-- Create helper function to get student's group ids without RLS check  
CREATE OR REPLACE FUNCTION public.get_student_group_ids(_student_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT group_id FROM public.group_students WHERE student_id = _student_id
$$;

-- Drop and recreate policies using the helper functions
DROP POLICY IF EXISTS "Instructors can view their groups" ON public.groups;
DROP POLICY IF EXISTS "Students can view their groups" ON public.groups;
DROP POLICY IF EXISTS "Instructors can view their group students" ON public.group_students;
DROP POLICY IF EXISTS "Instructors can manage their sessions" ON public.sessions;
DROP POLICY IF EXISTS "Students can view their sessions" ON public.sessions;
DROP POLICY IF EXISTS "Instructors can manage attendance" ON public.attendance;

-- Recreate groups policies
CREATE POLICY "Instructors can view their groups"
ON public.groups
FOR SELECT
USING (public.has_role(auth.uid(), 'instructor'::app_role) AND instructor_id = auth.uid());

CREATE POLICY "Students can view their groups"
ON public.groups
FOR SELECT
USING (public.has_role(auth.uid(), 'student'::app_role) AND id IN (SELECT public.get_student_group_ids(auth.uid())));

-- Recreate group_students policy
CREATE POLICY "Instructors can view their group students"
ON public.group_students
FOR SELECT
USING (public.has_role(auth.uid(), 'instructor'::app_role) AND group_id IN (SELECT public.get_instructor_group_ids(auth.uid())));

-- Recreate sessions policies
CREATE POLICY "Instructors can manage their sessions"
ON public.sessions
FOR ALL
USING (public.has_role(auth.uid(), 'instructor'::app_role) AND group_id IN (SELECT public.get_instructor_group_ids(auth.uid())));

CREATE POLICY "Students can view their sessions"
ON public.sessions
FOR SELECT
USING (public.has_role(auth.uid(), 'student'::app_role) AND group_id IN (SELECT public.get_student_group_ids(auth.uid())));

-- Recreate attendance policy
CREATE POLICY "Instructors can manage attendance"
ON public.attendance
FOR ALL
USING (
  public.has_role(auth.uid(), 'instructor'::app_role) 
  AND session_id IN (
    SELECT s.id FROM public.sessions s WHERE s.group_id IN (SELECT public.get_instructor_group_ids(auth.uid()))
  )
);