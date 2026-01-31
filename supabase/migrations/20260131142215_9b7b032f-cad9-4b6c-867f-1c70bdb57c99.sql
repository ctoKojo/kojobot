-- Fix sessions instructor policy
DROP POLICY IF EXISTS "Instructors can manage their sessions" ON public.sessions;

CREATE POLICY "Instructors can manage their sessions"
ON public.sessions
FOR ALL
USING (
  public.has_role(auth.uid(), 'instructor'::app_role) 
  AND group_id IN (SELECT g.id FROM public.groups g WHERE g.instructor_id = auth.uid())
);

-- Fix attendance instructor policy
DROP POLICY IF EXISTS "Instructors can manage attendance" ON public.attendance;

CREATE POLICY "Instructors can manage attendance"
ON public.attendance
FOR ALL
USING (
  public.has_role(auth.uid(), 'instructor'::app_role) 
  AND session_id IN (
    SELECT s.id FROM public.sessions s 
    WHERE s.group_id IN (SELECT g.id FROM public.groups g WHERE g.instructor_id = auth.uid())
  )
);