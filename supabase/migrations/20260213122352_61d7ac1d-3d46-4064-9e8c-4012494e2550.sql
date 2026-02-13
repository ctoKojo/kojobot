
-- Fix 1: Recreate session_details view with security_invoker to respect underlying table RLS
DROP VIEW IF EXISTS public.session_details;

CREATE VIEW public.session_details
WITH (security_invoker = true)
AS
SELECT s.id AS session_id,
    s.session_number,
    s.session_date,
    s.session_time,
    s.duration_minutes,
    s.status,
    s.topic,
    s.topic_ar,
    s.group_id,
    g.name AS group_name,
    g.name_ar AS group_name_ar,
    g.instructor_id,
    qa.id AS quiz_assignment_id,
    qa.quiz_id,
    q.title AS quiz_title,
    q.title_ar AS quiz_title_ar,
    a.id AS assignment_id,
    a.title AS assignment_title,
    a.title_ar AS assignment_title_ar
FROM sessions s
LEFT JOIN groups g ON s.group_id = g.id
LEFT JOIN quiz_assignments qa ON qa.session_id = s.id AND qa.is_active = true
LEFT JOIN quizzes q ON qa.quiz_id = q.id
LEFT JOIN assignments a ON a.session_id = s.id AND a.is_active = true;

-- Fix 2: Make materials bucket private
UPDATE storage.buckets SET public = false WHERE id = 'materials';

-- Add RLS policy for authenticated users to view materials
CREATE POLICY "Authenticated users can view materials files"
ON storage.objects FOR SELECT
USING (bucket_id = 'materials' AND auth.role() = 'authenticated');
