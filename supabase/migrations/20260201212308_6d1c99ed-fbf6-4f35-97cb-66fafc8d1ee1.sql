-- Recreate view with SECURITY INVOKER (default, explicit for clarity)
DROP VIEW IF EXISTS quiz_questions_student_view;

CREATE VIEW quiz_questions_student_view 
WITH (security_invoker = true) AS
SELECT 
  id,
  quiz_id,
  question_text,
  question_text_ar,
  question_type,
  options,
  points,
  order_index,
  image_url,
  created_at
FROM quiz_questions;

-- Grant access to the view
GRANT SELECT ON quiz_questions_student_view TO anon, authenticated;