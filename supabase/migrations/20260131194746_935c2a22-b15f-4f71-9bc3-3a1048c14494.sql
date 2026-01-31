-- Fix 1: Create a secure view for quiz questions that hides correct_answer from students
CREATE VIEW public.quiz_questions_student_view 
WITH (security_invoker=on) AS
SELECT 
  id,
  quiz_id,
  question_text,
  question_text_ar,
  question_type,
  options,
  points,
  order_index,
  created_at
FROM public.quiz_questions;

-- Fix 2: Update instructor profile policy to verify actual group membership
DROP POLICY IF EXISTS "Instructors can view student profiles in their groups" ON public.profiles;

CREATE POLICY "Instructors can view their own profile and student profiles in their groups"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'instructor'::app_role) AND (
    -- Instructors can view their own profile
    user_id = auth.uid()
    OR
    -- Instructors can only view profiles of students who are in their groups
    user_id IN (
      SELECT gs.student_id 
      FROM group_students gs
      INNER JOIN groups g ON gs.group_id = g.id
      WHERE g.instructor_id = auth.uid()
        AND gs.is_active = true
    )
  )
);

-- Fix 3: Update activity_logs insert policy to only allow users to insert their own logs
DROP POLICY IF EXISTS "Authenticated users can insert logs" ON public.activity_logs;

CREATE POLICY "Users can only insert their own logs"
ON public.activity_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);