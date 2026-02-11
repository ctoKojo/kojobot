
-- Add student confirmation column
ALTER TABLE public.makeup_sessions 
ADD COLUMN student_confirmed boolean DEFAULT null;

-- Add column to track which instructor is assigned
ALTER TABLE public.makeup_sessions 
ADD COLUMN assigned_instructor_id uuid DEFAULT null;

-- Allow students to update their own makeup sessions (for confirmation only)
CREATE POLICY "Students can update their makeup session confirmation"
ON public.makeup_sessions
FOR UPDATE
USING (has_role(auth.uid(), 'student'::app_role) AND student_id = auth.uid())
WITH CHECK (has_role(auth.uid(), 'student'::app_role) AND student_id = auth.uid());
