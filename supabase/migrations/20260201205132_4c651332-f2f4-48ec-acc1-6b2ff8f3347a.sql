-- Update RLS policy to allow instructors to delete quizzes they created
CREATE POLICY "Instructors can delete their quizzes"
ON public.quizzes
FOR DELETE
USING (has_role(auth.uid(), 'instructor'::app_role) AND created_by = auth.uid());

-- Also allow instructors to manage (insert/update) their own quizzes
CREATE POLICY "Instructors can insert quizzes"
ON public.quizzes
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'instructor'::app_role));

CREATE POLICY "Instructors can update their quizzes"
ON public.quizzes
FOR UPDATE
USING (has_role(auth.uid(), 'instructor'::app_role) AND created_by = auth.uid());