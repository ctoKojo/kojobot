-- 1. Backfill missing group_student_progress records
INSERT INTO group_student_progress (group_id, student_id, current_level_id)
SELECT gs.group_id, gs.student_id, g.level_id
FROM group_students gs
JOIN groups g ON g.id = gs.group_id
WHERE gs.is_active = true AND g.level_id IS NOT NULL
ON CONFLICT (group_id, student_id) DO NOTHING;

-- 2. Fix existing records with null current_level_id
UPDATE group_student_progress p
SET current_level_id = g.level_id
FROM group_students gs
JOIN groups g ON g.id = gs.group_id
WHERE p.group_id = gs.group_id
  AND p.student_id = gs.student_id
  AND gs.is_active = true
  AND p.current_level_id IS NULL
  AND g.level_id IS NOT NULL;

-- 3. Create view for final exam candidates
CREATE OR REPLACE VIEW public.final_exam_candidates WITH (security_invoker = true) AS
SELECT
  gsp.id AS progress_id,
  gsp.student_id,
  gsp.group_id,
  gsp.current_level_id,
  gsp.status,
  gsp.exam_scheduled_at,
  gsp.exam_submitted_at,
  gsp.graded_at,
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
WHERE gsp.status IN ('awaiting_exam', 'exam_scheduled');