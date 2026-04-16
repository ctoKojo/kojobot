
DROP VIEW IF EXISTS public.final_exam_candidates;
CREATE VIEW public.final_exam_candidates
WITH (security_invoker=on) AS
SELECT gsp.id AS progress_id,
    gsp.student_id,
    gsp.group_id,
    gsp.current_level_id,
    gsp.status,
    gsp.exam_scheduled_at,
    gsp.exam_submitted_at,
    gsp.graded_at,
    gsp.status_changed_at,
    p.full_name,
    p.full_name_ar,
    p.avatar_url,
    g.name AS group_name,
    g.name_ar AS group_name_ar,
    l.name AS level_name,
    l.name_ar AS level_name_ar,
    l.final_exam_quiz_id
   FROM group_student_progress gsp
     JOIN profiles p ON p.user_id = gsp.student_id
     JOIN groups g ON g.id = gsp.group_id
     JOIN levels l ON l.id = gsp.current_level_id
  WHERE gsp.status = ANY (ARRAY['awaiting_exam'::text, 'exam_scheduled'::text, 'graded'::text]);
