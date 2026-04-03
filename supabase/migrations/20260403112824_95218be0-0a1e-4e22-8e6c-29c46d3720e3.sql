CREATE POLICY "Students can view questions of assigned quizzes"
ON public.quiz_questions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND EXISTS (
    SELECT 1 FROM quiz_assignments qa
    WHERE qa.quiz_id = quiz_questions.quiz_id
      AND (
        qa.student_id = auth.uid()
        OR qa.group_id IN (
          SELECT gs.group_id FROM group_students gs
          WHERE gs.student_id = auth.uid()
        )
      )
  )
);