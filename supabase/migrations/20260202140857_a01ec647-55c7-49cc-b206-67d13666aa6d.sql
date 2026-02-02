-- Add RLS policy for students to view quiz questions (without correct_answer through the view)
-- Students need to be able to read questions for quizzes assigned to their group

-- First set security_invoker on the view so it uses the caller's permissions
ALTER VIEW public.quiz_questions_student_view SET (security_invoker = on);

-- Add policy for students to SELECT from quiz_questions base table
-- This is needed because the view uses security_invoker and will check base table policies
CREATE POLICY "Students can view questions for assigned quizzes"
ON public.quiz_questions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role) 
  AND quiz_id IN (
    SELECT qa.quiz_id 
    FROM quiz_assignments qa
    WHERE qa.is_active = true
    AND (
      qa.student_id = auth.uid()
      OR qa.group_id IN (
        SELECT group_id FROM group_students WHERE student_id = auth.uid() AND is_active = true
      )
    )
  )
);