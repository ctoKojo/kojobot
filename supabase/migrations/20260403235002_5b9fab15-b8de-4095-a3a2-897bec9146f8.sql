
-- ============================================================
-- Clean up fake backfilled data from mid-level start groups
-- ============================================================
-- Step 1: Identify backfilled sessions
-- A session is "backfilled" if:
--   - Its group has starting_session_number > 1
--   - The session's content_number < group's starting_session_number
--   - Status is 'completed' and not a makeup session

-- Step 2: Delete in FK-safe order

-- 2a. Delete session_evaluations for backfilled sessions
DELETE FROM session_evaluations
WHERE session_id IN (
  SELECT s.id FROM sessions s
  JOIN groups g ON g.id = s.group_id
  WHERE g.starting_session_number > 1
    AND s.status = 'completed'
    AND s.is_makeup IS NOT TRUE
    AND s.content_number IS NOT NULL
    AND s.content_number < g.starting_session_number
);

-- 2b. Delete assignment_submissions for backfilled assignments
DELETE FROM assignment_submissions
WHERE assignment_id IN (
  SELECT a.id FROM assignments a
  JOIN sessions s ON s.id = a.session_id
  JOIN groups g ON g.id = s.group_id
  WHERE g.starting_session_number > 1
    AND s.status = 'completed'
    AND s.is_makeup IS NOT TRUE
    AND s.content_number IS NOT NULL
    AND s.content_number < g.starting_session_number
    AND a.is_auto_generated = true
);

-- 2c. Delete auto-generated assignments for backfilled sessions
DELETE FROM assignments
WHERE session_id IN (
  SELECT s.id FROM sessions s
  JOIN groups g ON g.id = s.group_id
  WHERE g.starting_session_number > 1
    AND s.status = 'completed'
    AND s.is_makeup IS NOT TRUE
    AND s.content_number IS NOT NULL
    AND s.content_number < g.starting_session_number
)
AND is_auto_generated = true;

-- 2d. Delete quiz_submissions for backfilled quiz_assignments
DELETE FROM quiz_submissions
WHERE quiz_assignment_id IN (
  SELECT qa.id FROM quiz_assignments qa
  JOIN sessions s ON s.id = qa.session_id
  JOIN groups g ON g.id = s.group_id
  WHERE g.starting_session_number > 1
    AND s.status = 'completed'
    AND s.is_makeup IS NOT TRUE
    AND s.content_number IS NOT NULL
    AND s.content_number < g.starting_session_number
    AND qa.is_auto_generated = true
);

-- 2e. Delete auto-generated quiz_assignments for backfilled sessions
DELETE FROM quiz_assignments
WHERE session_id IN (
  SELECT s.id FROM sessions s
  JOIN groups g ON g.id = s.group_id
  WHERE g.starting_session_number > 1
    AND s.status = 'completed'
    AND s.is_makeup IS NOT TRUE
    AND s.content_number IS NOT NULL
    AND s.content_number < g.starting_session_number
)
AND is_auto_generated = true;

-- 2f. Delete auto-generated quizzes that are now orphaned
DELETE FROM quizzes
WHERE is_auto_generated = true
AND id NOT IN (SELECT quiz_id FROM quiz_assignments)
AND id NOT IN (SELECT quiz_id FROM curriculum_sessions WHERE quiz_id IS NOT NULL)
AND id NOT IN (SELECT final_exam_quiz_id FROM levels WHERE final_exam_quiz_id IS NOT NULL);

-- 2g. Delete attendance for backfilled sessions
DELETE FROM attendance
WHERE session_id IN (
  SELECT s.id FROM sessions s
  JOIN groups g ON g.id = s.group_id
  WHERE g.starting_session_number > 1
    AND s.status = 'completed'
    AND s.is_makeup IS NOT TRUE
    AND s.content_number IS NOT NULL
    AND s.content_number < g.starting_session_number
);

-- 2h. Delete the backfilled sessions themselves
DELETE FROM sessions
WHERE id IN (
  SELECT s.id FROM sessions s
  JOIN groups g ON g.id = s.group_id
  WHERE g.starting_session_number > 1
    AND s.status = 'completed'
    AND s.is_makeup IS NOT TRUE
    AND s.content_number IS NOT NULL
    AND s.content_number < g.starting_session_number
);

-- Step 3: Correct last_delivered_content_number for groups
-- Recalculate based on actual remaining completed sessions
UPDATE groups
SET last_delivered_content_number = COALESCE(
  (SELECT MAX(s.content_number) FROM sessions s 
   WHERE s.group_id = groups.id 
     AND s.status = 'completed' 
     AND s.is_makeup IS NOT TRUE),
  starting_session_number - 1
)
WHERE starting_session_number > 1;
