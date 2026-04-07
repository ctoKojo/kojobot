-- ============================================================
-- Cross-Module Integration Tests (Read-Only Validation)
-- Validates: data integrity, constraints, indexes
--
-- These tests verify the STRUCTURE is correct without needing
-- write access. For trigger-chain tests, use trigger-chain.test.sql
-- with service role access.
-- All queries are SELECT-only.
-- ============================================================

-- ═══ T1: Session unique index exists ═══
SELECT CASE
  WHEN count(*) > 0 THEN '✓ T1: Unique session_number index exists'
  ELSE '✗ T1 FAIL: Missing unique session_number index'
END as result
FROM pg_indexes
WHERE tablename = 'sessions' AND indexdef LIKE '%session_number%';

-- ═══ T2: No orphan sessions (sessions without valid group) ═══
SELECT CASE
  WHEN count(*) = 0 THEN '✓ T2: No orphan sessions'
  ELSE '✗ T2 FAIL: ' || count(*) || ' orphan sessions found'
END as result
FROM sessions s LEFT JOIN groups g ON g.id = s.group_id WHERE g.id IS NULL;

-- ═══ T3: No orphan group_students ═══
SELECT CASE
  WHEN count(*) = 0 THEN '✓ T3: No orphan group_students'
  ELSE '✗ T3 FAIL: ' || count(*) || ' orphan enrollments'
END as result
FROM group_students gs LEFT JOIN groups g ON g.id = gs.group_id WHERE g.id IS NULL;

-- ═══ T4: No orphan attendance records ═══
SELECT CASE
  WHEN count(*) = 0 THEN '✓ T4: No orphan attendance'
  ELSE '✗ T4 FAIL: ' || count(*) || ' orphan attendance records'
END as result
FROM attendance a LEFT JOIN sessions s ON s.id = a.session_id WHERE s.id IS NULL;

-- ═══ T5: No duplicate session_numbers in active groups ═══
SELECT CASE
  WHEN count(*) = 0 THEN '✓ T5: No duplicate session_numbers'
  ELSE '✗ T5 FAIL: ' || count(*) || ' groups with dupes'
END as result
FROM (
  SELECT group_id, session_number, count(*) as c
  FROM sessions WHERE is_makeup IS NOT TRUE
  GROUP BY group_id, session_number HAVING count(*) > 1
) dupes;

-- ═══ T6: No duplicate content_numbers for completed sessions ═══
SELECT CASE
  WHEN count(*) = 0 THEN '✓ T6: No duplicate content_numbers (completed)'
  ELSE '✗ T6 FAIL: ' || count(*) || ' groups with dupe content'
END as result
FROM (
  SELECT group_id, content_number, count(*) as c
  FROM sessions WHERE status = 'completed' AND content_number IS NOT NULL
  GROUP BY group_id, content_number HAVING count(*) > 1
) dupes;

-- ═══ T7: last_delivered_content_number consistency ═══
SELECT CASE
  WHEN count(*) = 0 THEN '✓ T7: last_delivered consistent with sessions'
  ELSE '✗ T7 WARN: ' || count(*) || ' groups may have stale last_delivered'
END as result
FROM groups g
WHERE g.has_started = true AND g.is_active = true
AND g.last_delivered_content_number > (
  SELECT COALESCE(MAX(content_number), 0) FROM sessions s
  WHERE s.group_id = g.id AND s.status = 'completed'
);

-- ═══ T8: Warning deactivation trigger exists ═══
SELECT CASE
  WHEN count(*) > 0 THEN '✓ T8: Warning deactivation trigger exists'
  ELSE '✗ T8 FAIL: trg_deactivate_warnings_on_cancel not found'
END as result
FROM pg_trigger
WHERE tgname = 'trg_deactivate_warnings_on_cancel';

-- ═══ T9: Notification category constraint exists ═══
SELECT CASE
  WHEN count(*) > 0 THEN '✓ T9: Notification category constraint exists'
  ELSE '✗ T9 FAIL: Missing category constraint'
END as result
FROM pg_constraint
WHERE conrelid = 'public.notifications'::regclass AND conname LIKE '%category%';

-- ═══ T10: record_payment_atomic RPC exists ═══
SELECT CASE
  WHEN count(*) > 0 THEN '✓ T10: record_payment_atomic RPC exists'
  ELSE '✗ T10 FAIL: record_payment_atomic not found'
END as result
FROM pg_proc WHERE proname = 'record_payment_atomic';

-- ═══ T11: Advisory lock function available ═══
SELECT CASE
  WHEN count(*) > 0 THEN '✓ T11: pg_advisory_xact_lock available'
  ELSE '✗ T11 FAIL: Advisory lock not available'
END as result
FROM pg_proc WHERE proname = 'pg_advisory_xact_lock';

-- ═══ T12: All active groups have valid level_id ═══
SELECT CASE
  WHEN count(*) = 0 THEN '✓ T12: All active groups have valid levels'
  ELSE '✗ T12 FAIL: ' || count(*) || ' groups with invalid level'
END as result
FROM groups g
LEFT JOIN levels l ON l.id = g.level_id
WHERE g.is_active = true AND g.level_id IS NOT NULL AND l.id IS NULL;

-- ═══ T13: No subscriptions with negative paid_amount ═══
SELECT CASE
  WHEN count(*) = 0 THEN '✓ T13: No negative paid_amounts'
  ELSE '✗ T13 FAIL: ' || count(*) || ' subscriptions with negative paid'
END as result
FROM subscriptions WHERE paid_amount < 0;

-- ═══ T14: paid_amount matches payments sum ═══
SELECT CASE
  WHEN count(*) = 0 THEN '✓ T14: paid_amount consistent with payments'
  ELSE '✗ T14 WARN: ' || count(*) || ' subscriptions with mismatched paid_amount'
END as result
FROM subscriptions s
WHERE s.paid_amount != COALESCE((
  SELECT SUM(amount) FROM payments p WHERE p.subscription_id = s.id
), 0)
AND s.status = 'active';
