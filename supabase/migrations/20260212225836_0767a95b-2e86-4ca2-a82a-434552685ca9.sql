-- Fix: Remove student direct access to quiz_questions base table
-- Students should ONLY access quiz_questions_student_view (which excludes correct_answer)
DROP POLICY IF EXISTS "Students can view questions for assigned quizzes" ON public.quiz_questions;