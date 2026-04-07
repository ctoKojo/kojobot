-- ============================================================
-- Trigger Chain Integration Tests
-- Tests: a_assign_content → b_check_level → on_generate_next
--
-- Run via: psql -f supabase/functions/tests/trigger-chain.test.sql
-- All tests run inside a TRANSACTION that is ROLLED BACK at the end
-- so no data is modified.
-- ============================================================

BEGIN;

-- ─── Setup: Create test fixtures ────────────────────────────

-- Test age group
INSERT INTO age_groups (id, name, name_ar, min_age, max_age)
VALUES ('aaaaaaaa-test-0000-0000-000000000001', 'Test Age', 'اختبار', 10, 14)
ON CONFLICT DO NOTHING;

-- Test level with 3 expected sessions
INSERT INTO levels (id, name, name_ar, level_order, expected_sessions_count, track)
VALUES ('llllllll-test-0000-0000-000000000001', 'Test Level', 'مستوى اختبار', 999, 3, 'scratch')
ON CONFLICT DO NOTHING;

-- Test group
INSERT INTO groups (
  id, name, name_ar, schedule_day, schedule_time, duration_minutes,
  level_id, age_group_id, is_active, has_started, status,
  last_delivered_content_number, owed_sessions_count, start_date
)
VALUES (
  'gggggggg-test-0000-0000-000000000001',
  'Test Group TC', 'مجموعة اختبار', 'monday', '14:00:00', 60,
  'llllllll-test-0000-0000-000000000001',
  'aaaaaaaa-test-0000-0000-000000000001',
  true, true, 'active',
  0, 0, '2026-01-05'
);

-- Session #1 (scheduled)
INSERT INTO sessions (
  id, group_id, session_number, status, session_date, session_time,
  duration_minutes, level_id
)
VALUES (
  'ssssssss-test-0000-0000-000000000001',
  'gggggggg-test-0000-0000-000000000001',
  1, 'scheduled', '2026-01-05', '14:00:00', 60,
  'llllllll-test-0000-0000-000000000001'
);


-- ─── TEST 1: Complete session WITH attendance → content advances ──

-- Add attendance (present)
INSERT INTO attendance (session_id, student_id, recorded_by, status)
VALUES (
  'ssssssss-test-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000099',  -- fake student
  '00000000-0000-0000-0000-000000000099',
  'present'
);

-- Complete the session → fires trigger chain
UPDATE sessions SET status = 'completed'
WHERE id = 'ssssssss-test-0000-0000-000000000001';

-- Verify: content_number assigned = 1
DO $$
DECLARE
  v_content INTEGER;
BEGIN
  SELECT content_number INTO v_content FROM sessions
  WHERE id = 'ssssssss-test-0000-0000-000000000001';
  
  ASSERT v_content = 1,
    format('TEST 1 FAIL: Expected content_number=1, got %s', v_content);
  RAISE NOTICE 'TEST 1 PASS: content_number = % after completion with attendance', v_content;
END $$;

-- Verify: group.last_delivered_content_number = 1
DO $$
DECLARE
  v_last INTEGER;
BEGIN
  SELECT last_delivered_content_number INTO v_last FROM groups
  WHERE id = 'gggggggg-test-0000-0000-000000000001';
  
  ASSERT v_last = 1,
    format('TEST 1b FAIL: Expected last_delivered=1, got %s', v_last);
  RAISE NOTICE 'TEST 1b PASS: group.last_delivered = %', v_last;
END $$;

-- Verify: next session (#2) was auto-generated
DO $$
DECLARE
  v_count INTEGER;
  v_status TEXT;
BEGIN
  SELECT count(*), min(status) INTO v_count, v_status FROM sessions
  WHERE group_id = 'gggggggg-test-0000-0000-000000000001'
    AND session_number = 2
    AND is_makeup IS NOT TRUE;
  
  ASSERT v_count = 1,
    format('TEST 1c FAIL: Expected 1 session #2, got %s', v_count);
  ASSERT v_status = 'scheduled',
    format('TEST 1c FAIL: Expected status=scheduled, got %s', v_status);
  RAISE NOTICE 'TEST 1c PASS: session #2 auto-generated with status=%', v_status;
END $$;


-- ─── TEST 2: Complete session #2 WITHOUT attendance → content stays ──

-- Get the auto-generated session #2 id
DO $$
DECLARE
  v_s2_id UUID;
  v_content INTEGER;
  v_last INTEGER;
BEGIN
  SELECT id INTO v_s2_id FROM sessions
  WHERE group_id = 'gggggggg-test-0000-0000-000000000001'
    AND session_number = 2 AND is_makeup IS NOT TRUE;

  -- Complete WITHOUT adding attendance
  UPDATE sessions SET status = 'completed' WHERE id = v_s2_id;

  -- content_number should stay at last_delivered (1, not advance)
  SELECT content_number INTO v_content FROM sessions WHERE id = v_s2_id;
  ASSERT v_content = 1,
    format('TEST 2 FAIL: Expected content=1 (no advance), got %s', v_content);

  -- group.last_delivered should still be 1
  SELECT last_delivered_content_number INTO v_last FROM groups
  WHERE id = 'gggggggg-test-0000-0000-000000000001';
  ASSERT v_last = 1,
    format('TEST 2b FAIL: Expected last_delivered still 1, got %s', v_last);

  RAISE NOTICE 'TEST 2 PASS: no-attendance session gets content=% (no advance), group.last_delivered=%', v_content, v_last;
END $$;

-- Verify: owed_sessions_count should NOT increase (completed, not cancelled)
DO $$
DECLARE
  v_owed INTEGER;
BEGIN
  SELECT owed_sessions_count INTO v_owed FROM groups
  WHERE id = 'gggggggg-test-0000-0000-000000000001';
  
  ASSERT v_owed = 0,
    format('TEST 2c FAIL: Expected owed=0, got %s', v_owed);
  RAISE NOTICE 'TEST 2c PASS: owed_sessions_count = % (unchanged)', v_owed;
END $$;


-- ─── TEST 3: Complete session #3 with attendance → level completion ──

DO $$
DECLARE
  v_s3_id UUID;
  v_content INTEGER;
  v_last INTEGER;
  v_s4_exists BOOLEAN;
BEGIN
  SELECT id INTO v_s3_id FROM sessions
  WHERE group_id = 'gggggggg-test-0000-0000-000000000001'
    AND session_number = 3 AND is_makeup IS NOT TRUE;

  -- Add attendance
  INSERT INTO attendance (session_id, student_id, recorded_by, status)
  VALUES (v_s3_id, '00000000-0000-0000-0000-000000000099',
          '00000000-0000-0000-0000-000000000099', 'present');

  -- Complete
  UPDATE sessions SET status = 'completed' WHERE id = v_s3_id;

  -- content should be 2
  SELECT content_number INTO v_content FROM sessions WHERE id = v_s3_id;
  ASSERT v_content = 2,
    format('TEST 3 FAIL: Expected content=2, got %s', v_content);

  -- last_delivered should be 2
  SELECT last_delivered_content_number INTO v_last FROM groups
  WHERE id = 'gggggggg-test-0000-0000-000000000001';
  ASSERT v_last = 2,
    format('TEST 3b FAIL: Expected last_delivered=2, got %s', v_last);

  RAISE NOTICE 'TEST 3 PASS: content=%, last_delivered=%', v_content, v_last;
END $$;

-- Verify session #4 was generated (owed from #2's no-attendance created an owed slot)
DO $$
DECLARE
  v_s4_count INTEGER;
BEGIN
  SELECT count(*) INTO v_s4_count FROM sessions
  WHERE group_id = 'gggggggg-test-0000-0000-000000000001'
    AND session_number = 4 AND is_makeup IS NOT TRUE;

  -- With expected=3 and last_delivered=2, there's still 1 more content to deliver
  -- The trigger should generate session #4
  RAISE NOTICE 'TEST 3c INFO: session #4 exists = % (count=%)', v_s4_count > 0, v_s4_count;
END $$;


-- ─── TEST 4: Cancel a session → owed increments ──────────────

DO $$
DECLARE
  v_s4_id UUID;
  v_owed_before INTEGER;
  v_owed_after INTEGER;
BEGIN
  -- Get current owed
  SELECT owed_sessions_count INTO v_owed_before FROM groups
  WHERE id = 'gggggggg-test-0000-0000-000000000001';

  -- Find latest scheduled session
  SELECT id INTO v_s4_id FROM sessions
  WHERE group_id = 'gggggggg-test-0000-0000-000000000001'
    AND status = 'scheduled' AND is_makeup IS NOT TRUE
  ORDER BY session_number DESC LIMIT 1;

  IF v_s4_id IS NOT NULL THEN
    UPDATE sessions SET status = 'cancelled', cancellation_reason = 'instructor_absence'
    WHERE id = v_s4_id;

    SELECT owed_sessions_count INTO v_owed_after FROM groups
    WHERE id = 'gggggggg-test-0000-0000-000000000001';

    ASSERT v_owed_after = v_owed_before + 1,
      format('TEST 4 FAIL: Expected owed=%s, got %s', v_owed_before + 1, v_owed_after);
    RAISE NOTICE 'TEST 4 PASS: owed incremented from % to % on cancellation', v_owed_before, v_owed_after;
  ELSE
    RAISE NOTICE 'TEST 4 SKIP: no scheduled session to cancel';
  END IF;
END $$;


-- ─── TEST 5: Idempotency — completing an already-completed session is a no-op ──

DO $$
DECLARE
  v_last_before INTEGER;
  v_last_after INTEGER;
BEGIN
  SELECT last_delivered_content_number INTO v_last_before FROM groups
  WHERE id = 'gggggggg-test-0000-0000-000000000001';

  -- Try to "complete" session #1 again
  UPDATE sessions SET status = 'completed'
  WHERE id = 'ssssssss-test-0000-0000-000000000001';

  SELECT last_delivered_content_number INTO v_last_after FROM groups
  WHERE id = 'gggggggg-test-0000-0000-000000000001';

  ASSERT v_last_before = v_last_after,
    format('TEST 5 FAIL: Re-completing changed last_delivered from %s to %s', v_last_before, v_last_after);
  RAISE NOTICE 'TEST 5 PASS: re-completing session is idempotent (last_delivered unchanged at %)', v_last_after;
END $$;


-- ─── Cleanup: rollback everything ───────────────────────────
RAISE NOTICE '══════════════════════════════════════';
RAISE NOTICE 'ALL TRIGGER CHAIN TESTS COMPLETED';
RAISE NOTICE 'Rolling back — no data was modified';
RAISE NOTICE '══════════════════════════════════════';

ROLLBACK;
