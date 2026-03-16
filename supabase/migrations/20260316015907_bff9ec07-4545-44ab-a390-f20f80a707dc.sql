
-- Step 1: Replacement sessions inherit content_number from their cancelled source
UPDATE public.sessions s
SET content_number = COALESCE(cancelled.content_number, cancelled.session_number)
FROM public.session_cancellation_logs scl
JOIN public.sessions cancelled ON cancelled.id = scl.session_id
WHERE scl.replacement_session_id = s.id
  AND s.content_number IS NULL;

-- Step 2: Academy closure cancelled sessions get their own session_number as content
UPDATE public.sessions
SET content_number = session_number
WHERE cancellation_reason = 'academy_closure'
  AND content_number IS NULL;

-- Step 3: All remaining null content_number sessions
UPDATE public.sessions
SET content_number = session_number
WHERE content_number IS NULL;

-- Step 4: Recalculate last_delivered_content_number from actual completed sessions
UPDATE public.groups g
SET last_delivered_content_number = sub.max_content
FROM (
  SELECT s.group_id, COALESCE(MAX(s.content_number), 0) AS max_content
  FROM public.sessions s
  WHERE s.status = 'completed' AND s.content_number IS NOT NULL
  GROUP BY s.group_id
) sub
WHERE sub.group_id = g.id
  AND g.has_started = true;

-- Step 5: Cap at expected_sessions_count
UPDATE public.groups g
SET last_delivered_content_number = l.expected_sessions_count
FROM public.levels l
WHERE l.id = g.level_id
  AND g.last_delivered_content_number > l.expected_sessions_count;

-- Step 6: Recalculate owed_sessions_count from source using subqueries
UPDATE public.groups g
SET owed_sessions_count = GREATEST(0,
  COALESCE((SELECT l.expected_sessions_count FROM public.levels l WHERE l.id = g.level_id), 12)
  - COALESCE(g.last_delivered_content_number, 0)
  - COALESCE((SELECT COUNT(*) FROM public.sessions s2 WHERE s2.group_id = g.id AND s2.status = 'scheduled'), 0)
)
WHERE g.has_started = true
  AND g.is_active = true;
