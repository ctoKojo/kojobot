
-- Add code_snippet column to quiz_questions
ALTER TABLE public.quiz_questions ADD COLUMN code_snippet text;

-- Recreate the student view to include code_snippet
DROP VIEW IF EXISTS public.quiz_questions_student_view;
CREATE VIEW public.quiz_questions_student_view AS
SELECT id, quiz_id, question_text, question_text_ar, question_type, options, points, order_index, image_url, code_snippet, created_at
FROM public.quiz_questions;
