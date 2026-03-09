
-- Drop old placement view
DROP VIEW IF EXISTS public.placement_exam_student_view;

-- Drop old tables (children first, then parents)
DROP TABLE IF EXISTS public.placement_exam_attempt_questions;
DROP TABLE IF EXISTS public.placement_exam_attempts;
DROP TABLE IF EXISTS public.placement_test_results;
DROP TABLE IF EXISTS public.placement_tests;
DROP TABLE IF EXISTS public.placement_exam_schedules;
DROP TABLE IF EXISTS public.placement_exam_settings;
DROP TABLE IF EXISTS public.placement_question_levels;
DROP TABLE IF EXISTS public.placement_question_bank;
DROP TABLE IF EXISTS public.placement_quiz_config;
DROP TABLE IF EXISTS public.placement_rules;
DROP TABLE IF EXISTS public.placement_skill_blueprint;
