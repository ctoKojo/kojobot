
-- Fix: Security Invoker on student safe view
DROP VIEW IF EXISTS placement_exam_student_view;
CREATE VIEW placement_exam_student_view WITH (security_invoker = true) AS
SELECT id, student_id, age_group, attempt_number, status,
       started_at, submitted_at, review_status, approved_level_id, created_at
FROM placement_exam_attempts;
