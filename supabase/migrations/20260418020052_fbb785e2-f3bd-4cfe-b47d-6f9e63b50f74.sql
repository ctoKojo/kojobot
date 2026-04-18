
-- Cleanup 1: deactivate warnings for canceled sessions
UPDATE public.instructor_warnings iw
SET is_active = false,
    resolved_at = now(),
    resolved_reason = 'cleanup_v2_session_canceled'
FROM public.sessions s
WHERE iw.session_id = s.id
  AND iw.is_active = true
  AND (s.status = 'canceled' OR s.cancellation_reason IS NOT NULL);

-- Cleanup 2: deactivate warnings for empty groups
UPDATE public.instructor_warnings iw
SET is_active = false,
    resolved_at = now(),
    resolved_reason = 'cleanup_v2_empty_group'
FROM public.sessions s
JOIN public.groups g ON g.id = s.group_id
WHERE iw.session_id = s.id
  AND iw.is_active = true
  AND iw.warning_type IN ('no_quiz','no_assignment','no_attendance','no_evaluation')
  AND NOT EXISTS (
    SELECT 1 FROM public.group_students gs
    WHERE gs.group_id = g.id AND gs.is_active = true
  );

-- Cleanup 3: deactivate no_quiz/no_assignment for sessions without curriculum requirement
WITH curr_match AS (
  SELECT DISTINCT ON (s.id)
    s.id AS session_id,
    cs.quiz_id,
    cs.assignment_attachment_url
  FROM public.sessions s
  LEFT JOIN public.curriculum_sessions cs
    ON cs.level_id = s.level_id
    AND cs.session_number = s.content_number
    AND cs.is_active = true
  ORDER BY s.id, cs.version DESC NULLS LAST
)
UPDATE public.instructor_warnings iw
SET is_active = false,
    resolved_at = now(),
    resolved_reason = 'cleanup_v2_no_curriculum_requirement'
FROM curr_match cm
WHERE iw.session_id = cm.session_id
  AND iw.is_active = true
  AND (
    (iw.warning_type = 'no_quiz' AND cm.quiz_id IS NULL)
    OR
    (iw.warning_type = 'no_assignment' AND (cm.assignment_attachment_url IS NULL OR length(trim(cm.assignment_attachment_url)) = 0))
  );
