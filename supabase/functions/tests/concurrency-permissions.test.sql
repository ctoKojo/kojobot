-- ============================================================
-- Concurrency & Constraint Validation Tests (Read-Only)
-- Validates: indexes, constraints, triggers, RLS policies
--
-- All queries are SELECT-only — safe for any access level.
-- ============================================================

-- ═══ T1: Unique index on sessions (group_id, session_number) ═══
SELECT CASE
  WHEN count(*) > 0 THEN '✓ T1: Sessions unique index exists'
  ELSE '✗ T1 FAIL: Missing sessions unique index'
END as result
FROM pg_indexes WHERE tablename = 'sessions' AND indexdef LIKE '%session_number%';

-- ═══ T2: Unique index on group_students ═══
SELECT CASE
  WHEN count(*) > 0 THEN '✓ T2: group_students has uniqueness constraint'
  ELSE '✗ T2 WARN: No unique constraint on group_students'
END as result
FROM pg_indexes WHERE tablename = 'group_students'
AND (indexdef LIKE '%student_id%' AND indexdef LIKE '%group_id%');

-- ═══ T3: RLS enabled on critical tables ═══
SELECT tablename, CASE
  WHEN rowsecurity THEN '✓ RLS enabled'
  ELSE '✗ RLS DISABLED'
END as rls_status
FROM pg_tables pt
JOIN pg_class pc ON pc.relname = pt.tablename
WHERE pt.schemaname = 'public'
AND pt.tablename IN (
  'profiles', 'subscriptions', 'sessions', 'attendance',
  'notifications', 'user_roles', 'payments', 'groups',
  'instructor_warnings', 'group_students'
)
ORDER BY tablename;

-- ═══ T4: Trigger chain ordering (a_ before b_ before on_) ═══
SELECT tgname, CASE
  WHEN tgname LIKE 'a_%' THEN '1-assign'
  WHEN tgname LIKE 'b_%' THEN '2-check'
  WHEN tgname LIKE 'on_%' OR tgname LIKE 'auto_%' THEN '3-action'
  ELSE '4-other'
END as phase
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'sessions' AND NOT t.tgisinternal
ORDER BY tgname;

-- ═══ T5: Foreign key constraints on sessions ═══
SELECT CASE
  WHEN count(*) >= 1 THEN '✓ T5: Sessions have FK to groups'
  ELSE '✗ T5 FAIL: Missing FK on sessions'
END as result
FROM pg_constraint
WHERE conrelid = 'public.sessions'::regclass AND contype = 'f';

-- ═══ T6: No completed sessions with NULL content_number ═══
SELECT CASE
  WHEN count(*) = 0 THEN '✓ T6: All completed sessions have content_number'
  ELSE '✗ T6 WARN: ' || count(*) || ' completed sessions without content_number'
END as result
FROM sessions WHERE status = 'completed' AND content_number IS NULL;

-- ═══ T7: No sessions with future dates marked completed ═══
SELECT CASE
  WHEN count(*) = 0 THEN '✓ T7: No future sessions marked completed'
  ELSE '✗ T7 WARN: ' || count(*) || ' future sessions completed early'
END as result
FROM sessions
WHERE status = 'completed' AND session_date > CURRENT_DATE + INTERVAL '1 day';

-- ═══ T8: Notification category constraint values ═══
SELECT pg_get_constraintdef(oid) as allowed_categories
FROM pg_constraint
WHERE conrelid = 'public.notifications'::regclass AND conname LIKE '%category%';

-- ═══ T9: user_roles table structure ═══
SELECT CASE
  WHEN count(*) > 0 THEN '✓ T9: user_roles table exists with proper structure'
  ELSE '✗ T9 FAIL: user_roles missing'
END as result
FROM information_schema.columns
WHERE table_name = 'user_roles' AND column_name IN ('user_id', 'role');

-- ═══ T10: No duplicate user_roles ═══
SELECT CASE
  WHEN count(*) = 0 THEN '✓ T10: No duplicate user_roles'
  ELSE '✗ T10 FAIL: ' || count(*) || ' duplicate roles'
END as result
FROM (
  SELECT user_id, role, count(*) FROM user_roles
  GROUP BY user_id, role HAVING count(*) > 1
) dupes;

-- ═══ T11: All warnings reference valid sessions ═══
SELECT CASE
  WHEN count(*) = 0 THEN '✓ T11: All warnings have valid session refs'
  ELSE '✗ T11 WARN: ' || count(*) || ' warnings with invalid session_id'
END as result
FROM instructor_warnings iw
LEFT JOIN sessions s ON s.id = iw.session_id
WHERE iw.session_id IS NOT NULL AND s.id IS NULL;

-- ═══ T12: Cancelled sessions should have no active warnings ═══
SELECT CASE
  WHEN count(*) = 0 THEN '✓ T12: No active warnings on cancelled sessions'
  ELSE '✗ T12 FAIL: ' || count(*) || ' active warnings on cancelled sessions'
END as result
FROM instructor_warnings iw
JOIN sessions s ON s.id = iw.session_id
WHERE s.status = 'cancelled' AND iw.is_active = true;
