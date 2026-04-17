
-- Restore student SELECT policy on quiz_questions
-- Students can read questions only for quizzes assigned to them (individually or via their active groups),
-- AND only when the assignment window is currently open (or the start time has passed).
CREATE POLICY "Students can view assigned quiz questions"
ON public.quiz_questions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.quiz_assignments qa
    WHERE qa.quiz_id = quiz_questions.quiz_id
      AND qa.is_active = true
      AND (qa.start_time IS NULL OR qa.start_time <= now())
      AND (
        qa.student_id = auth.uid()
        OR qa.group_id IN (
          SELECT gs.group_id
          FROM public.group_students gs
          WHERE gs.student_id = auth.uid()
            AND gs.is_active = true
        )
      )
  )
);
