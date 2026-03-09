
-- Fix security definer view: recreate with security_invoker = true
DROP VIEW IF EXISTS public.placement_v2_student_view;
CREATE VIEW public.placement_v2_student_view 
WITH (security_invoker = true)
AS
SELECT id, student_id, status, attempt_number,
       section_a_passed, section_b_passed,
       recommended_track, confidence_level, needs_manual_review,
       recommended_level_id, approved_level_id,
       started_at, submitted_at, created_at
FROM public.placement_v2_attempts;
