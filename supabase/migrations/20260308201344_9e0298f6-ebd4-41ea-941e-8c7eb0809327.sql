
-- Fix backfill: content_number was incorrectly assigned to previous-level sessions
-- Step 1: Clear content_number for sessions belonging to previous levels
UPDATE sessions s
SET content_number = NULL
FROM groups g
WHERE s.group_id = g.id
  AND g.starting_session_number IS NOT NULL
  AND g.starting_session_number > 1
  AND s.session_number < g.starting_session_number
  AND s.content_number IS NOT NULL;

-- Step 2: Reassign content_number sequentially for current-level completed sessions
-- Using a CTE with row_number to assign sequential content_numbers
WITH ranked AS (
  SELECT s.id,
         g.starting_session_number,
         ROW_NUMBER() OVER (PARTITION BY s.group_id ORDER BY s.session_number ASC) AS rn
  FROM sessions s
  JOIN groups g ON g.id = s.group_id
  WHERE g.starting_session_number IS NOT NULL
    AND g.starting_session_number > 1
    AND s.session_number >= g.starting_session_number
    AND s.status = 'completed'
    AND s.is_makeup = false
)
UPDATE sessions
SET content_number = ranked.starting_session_number - 1 + ranked.rn
FROM ranked
WHERE sessions.id = ranked.id;

-- Step 3: Also reassign content_number for completed makeup sessions in current level
WITH ranked_makeup AS (
  SELECT s.id,
         g.starting_session_number,
         -- Makeup sessions get content_number based on group's sequence
         (SELECT COALESCE(MAX(s2.content_number), g.starting_session_number - 1)
          FROM sessions s2 
          WHERE s2.group_id = s.group_id 
            AND s2.content_number IS NOT NULL 
            AND s2.id != s.id
            AND s2.session_date <= s.session_date) + 1 AS new_content_number
  FROM sessions s
  JOIN groups g ON g.id = s.group_id
  WHERE g.starting_session_number IS NOT NULL
    AND g.starting_session_number > 1
    AND s.is_makeup = true
    AND s.status = 'completed'
    AND s.content_number IS NOT NULL
)
UPDATE sessions
SET content_number = ranked_makeup.new_content_number
FROM ranked_makeup
WHERE sessions.id = ranked_makeup.id;

-- Step 4: Recalculate last_delivered_content_number for affected groups
UPDATE groups g
SET last_delivered_content_number = COALESCE(
  (SELECT MAX(s.content_number) FROM sessions s WHERE s.group_id = g.id AND s.content_number IS NOT NULL),
  g.starting_session_number - 1
)
WHERE g.starting_session_number IS NOT NULL
  AND g.starting_session_number > 1
  AND g.has_started = true;
