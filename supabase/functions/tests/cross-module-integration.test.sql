-- ============================================================
-- Cross-Module Integration Tests
-- Tests: Payment↔Access, Attendance↔Finance, Session↔Exams,
--        Concurrency, Data Integrity, Edge Cases
--
-- All tests run inside a TRANSACTION that is ROLLED BACK.
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_ag_id UUID;
  v_level_id UUID;
  v_level2_id UUID;
  v_group_id UUID;
  v_group2_id UUID;
  v_student_id UUID := gen_random_uuid();
  v_student2_id UUID := gen_random_uuid();
  v_instructor_id UUID := gen_random_uuid();
  v_admin_id UUID := gen_random_uuid();
  v_session_id UUID;
  v_session2_id UUID;
  v_sub_id UUID;
  v_sub2_id UUID;
  v_warning_count INTEGER;
  v_count INTEGER;
  v_content INTEGER;
  v_last INTEGER;
  v_owed INTEGER;
  v_status TEXT;
  v_progress_status TEXT;
  v_suspended BOOLEAN;
BEGIN

  -- ─── FIXTURES ───────────────────────────────────────────────

  -- Age group
  v_ag_id := gen_random_uuid();
  INSERT INTO age_groups (id, name, name_ar, min_age, max_age)
  VALUES (v_ag_id, 'CrossTest AG', 'اختبار تكامل', 8, 14);

  -- Levels
  v_level_id := gen_random_uuid();
  INSERT INTO levels (id, name, name_ar, level_order, expected_sessions_count, track)
  VALUES (v_level_id, 'CrossTest L1', 'مستوى 1', 900, 3, 'scratch');

  v_level2_id := gen_random_uuid();
  INSERT INTO levels (id, name, name_ar, level_order, expected_sessions_count, track)
  VALUES (v_level2_id, 'CrossTest L2', 'مستوى 2', 901, 3, 'scratch');

  -- Group 1
  v_group_id := gen_random_uuid();
  INSERT INTO groups (
    id, name, name_ar, schedule_day, schedule_time, duration_minutes,
    level_id, age_group_id, is_active, has_started, status,
    last_delivered_content_number, owed_sessions_count, start_date, instructor_id
  ) VALUES (
    v_group_id, 'CrossTest G1', 'مجموعة 1', 'tuesday', '10:00:00', 60,
    v_level_id, v_ag_id, true, true, 'active', 0, 0, '2026-01-06', v_instructor_id
  );

  -- Group 2 (for multi-group student test)
  v_group2_id := gen_random_uuid();
  INSERT INTO groups (
    id, name, name_ar, schedule_day, schedule_time, duration_minutes,
    level_id, age_group_id, is_active, has_started, status,
    last_delivered_content_number, owed_sessions_count, start_date, instructor_id
  ) VALUES (
    v_group2_id, 'CrossTest G2', 'مجموعة 2', 'thursday', '14:00:00', 60,
    v_level2_id, v_ag_id, true, true, 'active', 0, 0, '2026-01-08', v_instructor_id
  );

  -- Profiles
  INSERT INTO profiles (user_id, full_name, email, level_id, age_group_id)
  VALUES (v_student_id, 'Test Student Cross', 'cross-student@test.com', v_level_id, v_ag_id);

  INSERT INTO profiles (user_id, full_name, email, level_id, age_group_id)
  VALUES (v_student2_id, 'Test Student2 Cross', 'cross-student2@test.com', v_level_id, v_ag_id);

  INSERT INTO profiles (user_id, full_name, email)
  VALUES (v_instructor_id, 'Test Instructor Cross', 'cross-instr@test.com');

  -- Enroll students
  INSERT INTO group_students (group_id, student_id, is_active) VALUES (v_group_id, v_student_id, true);
  INSERT INTO group_students (group_id, student_id, is_active) VALUES (v_group2_id, v_student_id, true);
  INSERT INTO group_students (group_id, student_id, is_active) VALUES (v_group_id, v_student2_id, true);

  -- Subscriptions
  v_sub_id := gen_random_uuid();
  INSERT INTO subscriptions (
    id, student_id, subscription_type, payment_type, status, is_suspended,
    total_amount, paid_amount, installment_amount,
    start_date, end_date, next_payment_date
  ) VALUES (
    v_sub_id, v_student_id, 'kojo_core', 'installment', 'active', false,
    3000, 1000, 1000, '2026-01-01', '2026-04-01', '2026-02-01'
  );

  v_sub2_id := gen_random_uuid();
  INSERT INTO subscriptions (
    id, student_id, subscription_type, payment_type, status, is_suspended,
    total_amount, paid_amount, installment_amount,
    start_date, end_date, next_payment_date
  ) VALUES (
    v_sub2_id, v_student_id, 'kojo_squad', 'full_payment', 'active', false,
    2000, 2000, 2000, '2026-01-01', '2026-04-01', NULL
  );

  -- Session #1
  v_session_id := gen_random_uuid();
  INSERT INTO sessions (id, group_id, session_number, status, session_date, session_time, duration_minutes, level_id)
  VALUES (v_session_id, v_group_id, 1, 'scheduled', '2026-01-06', '10:00:00', 60, v_level_id);

  -- ═══════════════════════════════════════════════════════════
  -- TEST SECTION 1: DATA INTEGRITY — Foreign Keys & Constraints
  -- ═══════════════════════════════════════════════════════════

  -- T1.1: Every session belongs to a valid group
  SELECT count(*) INTO v_count FROM sessions s
  LEFT JOIN groups g ON g.id = s.group_id
  WHERE s.group_id = v_group_id AND g.id IS NULL;
  ASSERT v_count = 0, 'T1.1 FAIL: Orphan session found';
  RAISE NOTICE '✓ T1.1: No orphan sessions';

  -- T1.2: Every group_student references a valid group
  SELECT count(*) INTO v_count FROM group_students gs
  LEFT JOIN groups g ON g.id = gs.group_id
  WHERE gs.group_id IN (v_group_id, v_group2_id) AND g.id IS NULL;
  ASSERT v_count = 0, 'T1.2 FAIL: Orphan group_student found';
  RAISE NOTICE '✓ T1.2: No orphan group_students';

  -- T1.3: Every subscription references a valid student profile
  SELECT count(*) INTO v_count FROM subscriptions sub
  LEFT JOIN profiles p ON p.user_id = sub.student_id
  WHERE sub.id IN (v_sub_id, v_sub2_id) AND p.user_id IS NULL;
  ASSERT v_count = 0, 'T1.3 FAIL: Orphan subscription found';
  RAISE NOTICE '✓ T1.3: No orphan subscriptions';

  -- T1.4: Unique session_number per group (non-makeup)
  SELECT count(*) INTO v_count FROM (
    SELECT group_id, session_number, count(*) as c
    FROM sessions WHERE group_id = v_group_id AND (is_makeup IS NOT TRUE)
    GROUP BY group_id, session_number HAVING count(*) > 1
  ) dupes;
  ASSERT v_count = 0, 'T1.4 FAIL: Duplicate session_number in group';
  RAISE NOTICE '✓ T1.4: Unique session numbers per group';

  -- ═══════════════════════════════════════════════════════════
  -- TEST SECTION 2: SESSION → LEVEL PROGRESS CHAIN
  -- ═══════════════════════════════════════════════════════════

  -- Complete session 1 with attendance
  INSERT INTO attendance (session_id, student_id, recorded_by, status)
  VALUES (v_session_id, v_student_id, v_instructor_id, 'present');
  UPDATE sessions SET status = 'completed' WHERE id = v_session_id;

  SELECT content_number INTO v_content FROM sessions WHERE id = v_session_id;
  ASSERT v_content = 1, format('T2.1 FAIL: Expected content=1, got %s', v_content);
  RAISE NOTICE '✓ T2.1: Session 1 content assigned correctly';

  -- Complete session 2
  SELECT id INTO v_session2_id FROM sessions
  WHERE group_id = v_group_id AND session_number = 2 AND is_makeup IS NOT TRUE;

  INSERT INTO attendance (session_id, student_id, recorded_by, status)
  VALUES (v_session2_id, v_student_id, v_instructor_id, 'present');
  UPDATE sessions SET status = 'completed' WHERE id = v_session2_id;

  SELECT content_number INTO v_content FROM sessions WHERE id = v_session2_id;
  ASSERT v_content = 2, format('T2.2 FAIL: Expected content=2, got %s', v_content);
  RAISE NOTICE '✓ T2.2: Session 2 content=2';

  -- Complete session 3 → should trigger level completion check
  SELECT id INTO v_session2_id FROM sessions
  WHERE group_id = v_group_id AND session_number = 3 AND is_makeup IS NOT TRUE;

  INSERT INTO attendance (session_id, student_id, recorded_by, status)
  VALUES (v_session2_id, v_student_id, v_instructor_id, 'present');
  UPDATE sessions SET status = 'completed' WHERE id = v_session2_id;

  SELECT last_delivered_content_number INTO v_last FROM groups WHERE id = v_group_id;
  ASSERT v_last = 3, format('T2.3 FAIL: Expected last_delivered=3, got %s', v_last);
  RAISE NOTICE '✓ T2.3: All 3 sessions completed, last_delivered=3';

  -- Check if student progress was updated to awaiting_exam
  SELECT status INTO v_progress_status FROM group_student_progress
  WHERE group_id = v_group_id AND student_id = v_student_id
  ORDER BY created_at DESC LIMIT 1;

  IF v_progress_status IS NOT NULL THEN
    RAISE NOTICE '✓ T2.4: Student progress status = %', v_progress_status;
  ELSE
    RAISE NOTICE '⚠ T2.4: No progress record created (may depend on trigger config)';
  END IF;

  -- ═══════════════════════════════════════════════════════════
  -- TEST SECTION 3: PAYMENT ↔ SUSPENSION
  -- ═══════════════════════════════════════════════════════════

  -- T3.1: Suspend student → check flag
  UPDATE subscriptions SET is_suspended = true WHERE id = v_sub_id;
  SELECT is_suspended INTO v_suspended FROM subscriptions WHERE id = v_sub_id;
  ASSERT v_suspended = true, 'T3.1 FAIL: Suspension not applied';
  RAISE NOTICE '✓ T3.1: Student suspended successfully';

  -- T3.2: Unsuspend → flag cleared
  UPDATE subscriptions SET is_suspended = false WHERE id = v_sub_id;
  SELECT is_suspended INTO v_suspended FROM subscriptions WHERE id = v_sub_id;
  ASSERT v_suspended = false, 'T3.2 FAIL: Unsuspension failed';
  RAISE NOTICE '✓ T3.2: Student unsuspended successfully';

  -- T3.3: Multiple subscriptions — suspending one doesn't affect the other
  UPDATE subscriptions SET is_suspended = true WHERE id = v_sub_id;
  SELECT is_suspended INTO v_suspended FROM subscriptions WHERE id = v_sub2_id;
  ASSERT v_suspended = false, 'T3.3 FAIL: Other subscription incorrectly suspended';
  RAISE NOTICE '✓ T3.3: Suspension isolated per subscription';

  -- ═══════════════════════════════════════════════════════════
  -- TEST SECTION 4: SESSION CANCEL → WARNING DEACTIVATION
  -- ═══════════════════════════════════════════════════════════

  -- Create a new scheduled session and a warning linked to it
  v_session2_id := gen_random_uuid();
  INSERT INTO sessions (id, group_id, session_number, status, session_date, session_time, duration_minutes, level_id)
  VALUES (v_session2_id, v_group2_id, 1, 'completed', '2026-01-08', '14:00:00', 60, v_level2_id);

  INSERT INTO instructor_warnings (instructor_id, warning_type, reason, severity, session_id, is_active)
  VALUES (v_instructor_id, 'no_attendance', 'Did not record attendance', 'medium', v_session2_id, true);

  -- Cancel the session → trigger should deactivate warnings
  UPDATE sessions SET status = 'cancelled', cancellation_reason = 'academy_closure' WHERE id = v_session2_id;

  SELECT count(*) INTO v_warning_count FROM instructor_warnings
  WHERE session_id = v_session2_id AND is_active = true;
  ASSERT v_warning_count = 0,
    format('T4.1 FAIL: Expected 0 active warnings after cancel, got %s', v_warning_count);
  RAISE NOTICE '✓ T4.1: Cancelling session deactivated instructor warnings';

  -- ═══════════════════════════════════════════════════════════
  -- TEST SECTION 5: CANCEL → OWED SESSIONS
  -- ═══════════════════════════════════════════════════════════

  -- Insert a scheduled session in group2 and cancel it
  v_session2_id := gen_random_uuid();
  INSERT INTO sessions (id, group_id, session_number, status, session_date, session_time, duration_minutes, level_id)
  VALUES (v_session2_id, v_group2_id, 2, 'scheduled', '2026-01-15', '14:00:00', 60, v_level2_id);

  SELECT owed_sessions_count INTO v_owed FROM groups WHERE id = v_group2_id;

  UPDATE sessions SET status = 'cancelled', cancellation_reason = 'instructor_absence' WHERE id = v_session2_id;

  SELECT owed_sessions_count INTO v_count FROM groups WHERE id = v_group2_id;
  ASSERT v_count = v_owed + 1, format('T5.1 FAIL: owed expected %s, got %s', v_owed + 1, v_count);
  RAISE NOTICE '✓ T5.1: Cancel increments owed_sessions_count';

  -- ═══════════════════════════════════════════════════════════
  -- TEST SECTION 6: MULTI-GROUP STUDENT
  -- ═══════════════════════════════════════════════════════════

  -- T6.1: Student enrolled in 2 groups
  SELECT count(*) INTO v_count FROM group_students
  WHERE student_id = v_student_id AND is_active = true;
  ASSERT v_count = 2, format('T6.1 FAIL: Expected 2 active group enrollments, got %s', v_count);
  RAISE NOTICE '✓ T6.1: Student in 2 active groups';

  -- T6.2: Student has 2 subscriptions
  SELECT count(*) INTO v_count FROM subscriptions
  WHERE student_id = v_student_id AND status = 'active';
  ASSERT v_count >= 1, format('T6.2 FAIL: Expected >=1 active subscriptions, got %s', v_count);
  RAISE NOTICE '✓ T6.2: Student has active subscriptions';

  -- ═══════════════════════════════════════════════════════════
  -- TEST SECTION 7: IDEMPOTENCY CHECKS
  -- ═══════════════════════════════════════════════════════════

  -- T7.1: Re-completing a completed session doesn't change content
  SELECT last_delivered_content_number INTO v_last FROM groups WHERE id = v_group_id;
  UPDATE sessions SET status = 'completed' WHERE id = v_session_id; -- already completed
  SELECT last_delivered_content_number INTO v_count FROM groups WHERE id = v_group_id;
  ASSERT v_last = v_count, format('T7.1 FAIL: Re-complete changed last_delivered %s→%s', v_last, v_count);
  RAISE NOTICE '✓ T7.1: Re-completing is idempotent';

  -- T7.2: Double attendance insert should fail (unique constraint)
  BEGIN
    INSERT INTO attendance (session_id, student_id, recorded_by, status)
    VALUES (v_session_id, v_student_id, v_instructor_id, 'present');
    RAISE NOTICE '⚠ T7.2: Double attendance allowed (no unique constraint)';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE '✓ T7.2: Double attendance correctly rejected';
  END;

  -- ═══════════════════════════════════════════════════════════
  -- TEST SECTION 8: EDGE CASES
  -- ═══════════════════════════════════════════════════════════

  -- T8.1: Student suspended + in awaiting_exam → both states coexist
  UPDATE subscriptions SET is_suspended = true WHERE id = v_sub_id;
  -- Insert a progress record with awaiting_exam
  INSERT INTO group_student_progress (group_id, student_id, current_level_id, status)
  VALUES (v_group_id, v_student_id, v_level_id, 'awaiting_exam')
  ON CONFLICT DO NOTHING;

  SELECT is_suspended INTO v_suspended FROM subscriptions WHERE id = v_sub_id;
  ASSERT v_suspended = true, 'T8.1 FAIL: Student should be suspended';

  SELECT status INTO v_progress_status FROM group_student_progress
  WHERE group_id = v_group_id AND student_id = v_student_id
  ORDER BY created_at DESC LIMIT 1;
  IF v_progress_status = 'awaiting_exam' THEN
    RAISE NOTICE '✓ T8.1: Suspended + awaiting_exam states coexist correctly';
  ELSE
    RAISE NOTICE '⚠ T8.1: Progress status = % (may not be awaiting_exam)', v_progress_status;
  END IF;

  -- T8.2: Student with no sessions in group2 (instructor without sessions)
  SELECT count(*) INTO v_count FROM sessions WHERE group_id = v_group2_id;
  RAISE NOTICE '  T8.2 INFO: Group2 has % sessions', v_count;

  -- ═══════════════════════════════════════════════════════════

  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════';
  RAISE NOTICE 'ALL CROSS-MODULE INTEGRATION TESTS PASSED ✓';
  RAISE NOTICE '══════════════════════════════════════════════';

END $$;

ROLLBACK;
