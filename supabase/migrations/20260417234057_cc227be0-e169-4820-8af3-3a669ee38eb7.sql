-- Prevent duplicate manual quiz_assignments per session
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_manual_quiz_per_session
ON quiz_assignments (session_id)
WHERE is_active = true AND is_auto_generated = false AND session_id IS NOT NULL;

-- Prevent duplicate manual assignments per session
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_manual_assignment_per_session
ON assignments (session_id)
WHERE is_active = true AND is_auto_generated = false AND session_id IS NOT NULL;