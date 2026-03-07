-- Clean up duplicate RLS policies (old system vs new migration duplicates)
DROP POLICY IF EXISTS "Admin reads attempt questions" ON placement_exam_attempt_questions;
DROP POLICY IF EXISTS "Admin manages all attempts" ON placement_exam_attempts;
DROP POLICY IF EXISTS "Student reads own attempts" ON placement_exam_attempts;
DROP POLICY IF EXISTS "Admin full access on question bank" ON placement_question_bank;