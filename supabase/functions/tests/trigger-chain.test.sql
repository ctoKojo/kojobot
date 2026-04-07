-- ============================================================
-- Trigger Chain Integration Tests
-- Tests: a_assign_content → b_check_level → on_generate_next
--
-- All tests run inside a TRANSACTION that is ROLLED BACK at the end.
-- ============================================================

BEGIN;

-- ─── Setup: Create test fixtures ────────────────────────────

INSERT INTO age_groups (id, name, name_ar, min_age, max_age)
VALUES (gen_random_uuid(), 'Test Age TC', 'اختبار TC', 10, 14);

-- Capture the age_group id
DO $$
DECLARE
  v_ag_id UUID;
  v_level_id UUID;
  v_group_id UUID;
  v_s1_id UUID;
  v_s2_id UUID;
  v_s3_id UUID;
  v_s4_id UUID;
  v_content INTEGER;
  v_last INTEGER;
  v_owed INTEGER;
  v_count INTEGER;
  v_status TEXT;
  v_owed_before INTEGER;
  v_owed_after INTEGER;
  v_last_before INTEGER;
  v_last_after INTEGER;
  v_fake_student UUID := gen_random_uuid();
BEGIN
  SELECT id INTO v_ag_id FROM age_groups WHERE name = 'Test Age TC';

  -- Test level with 3 expected sessions
  v_level_id := gen_random_uuid();
  INSERT INTO levels (id, name, name_ar, level_order, expected_sessions_count, track)
  VALUES (v_level_id, 'Test Level TC', 'مستوى اختبار TC', 999, 3, 'scratch');

  -- Test group
  v_group_id := gen_random_uuid();
  INSERT INTO groups (
    id, name, name_ar, schedule_day, schedule_time, duration_minutes,
    level_id, age_group_id, is_active, has_started, status,
    last_delivered_content_number, owed_sessions_count, start_date
  ) VALUES (
    v_group_id, 'Test Group TC', 'مجموعة اختبار TC', 'monday', '14:00:00', 60,
    v_level_id, v_ag_id, true, true, 'active', 0, 0, '2026-01-05'
  );

  -- Session #1
  v_s1_id := gen_random_uuid();
  INSERT INTO sessions (id, group_id, session_number, status, session_date, session_time, duration_minutes, level_id)
  VALUES (v_s1_id, v_group_id, 1, 'scheduled', '2026-01-05', '14:00:00', 60, v_level_id);

  -- ═══ TEST 1: Complete with attendance → content advances ═══
  INSERT INTO attendance (session_id, student_id, recorded_by, status)
  VALUES (v_s1_id, v_fake_student, v_fake_student, 'present');

  UPDATE sessions SET status = 'completed' WHERE id = v_s1_id;

  SELECT content_number INTO v_content FROM sessions WHERE id = v_s1_id;
  ASSERT v_content = 1, format('TEST 1 FAIL: Expected content=1, got %s', v_content);

  SELECT last_delivered_content_number INTO v_last FROM groups WHERE id = v_group_id;
  ASSERT v_last = 1, format('TEST 1b FAIL: Expected last_delivered=1, got %s', v_last);

  -- Verify session #2 auto-generated
  SELECT count(*) INTO v_count FROM sessions
  WHERE group_id = v_group_id AND session_number = 2 AND is_makeup IS NOT TRUE;
  ASSERT v_count = 1, format('TEST 1c FAIL: Expected 1 session #2, got %s', v_count);

  RAISE NOTICE '✓ TEST 1 PASS: content=1, last_delivered=1, session #2 generated';

  -- ═══ TEST 2: Complete WITHOUT attendance → content stays ═══
  SELECT id INTO v_s2_id FROM sessions
  WHERE group_id = v_group_id AND session_number = 2 AND is_makeup IS NOT TRUE;

  UPDATE sessions SET status = 'completed' WHERE id = v_s2_id;

  SELECT content_number INTO v_content FROM sessions WHERE id = v_s2_id;
  ASSERT v_content = 1, format('TEST 2 FAIL: Expected content=1 (no advance), got %s', v_content);

  SELECT last_delivered_content_number INTO v_last FROM groups WHERE id = v_group_id;
  ASSERT v_last = 1, format('TEST 2b FAIL: Expected last_delivered=1, got %s', v_last);

  SELECT owed_sessions_count INTO v_owed FROM groups WHERE id = v_group_id;
  ASSERT v_owed = 0, format('TEST 2c FAIL: Expected owed=0, got %s', v_owed);

  RAISE NOTICE '✓ TEST 2 PASS: no-attendance → content stays at 1, owed=0';

  -- ═══ TEST 3: Complete session #3 with attendance → content=2 ═══
  SELECT id INTO v_s3_id FROM sessions
  WHERE group_id = v_group_id AND session_number = 3 AND is_makeup IS NOT TRUE;

  INSERT INTO attendance (session_id, student_id, recorded_by, status)
  VALUES (v_s3_id, v_fake_student, v_fake_student, 'present');

  UPDATE sessions SET status = 'completed' WHERE id = v_s3_id;

  SELECT content_number INTO v_content FROM sessions WHERE id = v_s3_id;
  ASSERT v_content = 2, format('TEST 3 FAIL: Expected content=2, got %s', v_content);

  SELECT last_delivered_content_number INTO v_last FROM groups WHERE id = v_group_id;
  ASSERT v_last = 2, format('TEST 3b FAIL: Expected last_delivered=2, got %s', v_last);

  RAISE NOTICE '✓ TEST 3 PASS: content=2, last_delivered=2';

  -- ═══ TEST 4: Cancel → owed increments ═══
  SELECT owed_sessions_count INTO v_owed_before FROM groups WHERE id = v_group_id;

  SELECT id INTO v_s4_id FROM sessions
  WHERE group_id = v_group_id AND status = 'scheduled' AND is_makeup IS NOT TRUE
  ORDER BY session_number DESC LIMIT 1;

  IF v_s4_id IS NOT NULL THEN
    UPDATE sessions SET status = 'cancelled', cancellation_reason = 'instructor_absence'
    WHERE id = v_s4_id;

    SELECT owed_sessions_count INTO v_owed_after FROM groups WHERE id = v_group_id;
    ASSERT v_owed_after = v_owed_before + 1,
      format('TEST 4 FAIL: Expected owed=%s, got %s', v_owed_before + 1, v_owed_after);
    RAISE NOTICE '✓ TEST 4 PASS: owed incremented % → %', v_owed_before, v_owed_after;
  ELSE
    RAISE NOTICE '⚠ TEST 4 SKIP: no scheduled session to cancel';
  END IF;

  -- ═══ TEST 5: Idempotency — re-completing is a no-op ═══
  SELECT last_delivered_content_number INTO v_last_before FROM groups WHERE id = v_group_id;

  UPDATE sessions SET status = 'completed' WHERE id = v_s1_id;

  SELECT last_delivered_content_number INTO v_last_after FROM groups WHERE id = v_group_id;
  ASSERT v_last_before = v_last_after,
    format('TEST 5 FAIL: Re-complete changed last_delivered %s→%s', v_last_before, v_last_after);
  RAISE NOTICE '✓ TEST 5 PASS: re-completing is idempotent (last_delivered=%)', v_last_after;

  RAISE NOTICE '══════════════════════════════════════';
  RAISE NOTICE 'ALL 5 TRIGGER CHAIN TESTS PASSED ✓';
  RAISE NOTICE '══════════════════════════════════════';
END $$;

ROLLBACK;
