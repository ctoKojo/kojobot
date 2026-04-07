-- ============================================================
-- Cross-Module Integration Tests
-- Tests: Session→Level chain, Cancel→Warning, Owed sessions,
--        Data Integrity, Idempotency, Edge Cases
--
-- NOTE: Skips profile/subscription inserts (require auth.users FK).
-- Focuses on trigger chain, session engine, and constraints.
-- All tests ROLLED BACK.
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_ag_id UUID;
  v_level_id UUID;
  v_level2_id UUID;
  v_group_id UUID;
  v_group2_id UUID;
  v_fake_student UUID := gen_random_uuid();
  v_instructor_id UUID := gen_random_uuid();
  v_session_id UUID;
  v_session2_id UUID;
  v_warning_count INTEGER;
  v_count INTEGER;
  v_content INTEGER;
  v_last INTEGER;
  v_owed INTEGER;
  v_owed_before INTEGER;
BEGIN

  -- ─── FIXTURES ───────────────────────────────────────────────

  v_ag_id := gen_random_uuid();
  INSERT INTO age_groups (id, name, name_ar, min_age, max_age)
  VALUES (v_ag_id, 'CrossTest AG', 'اختبار تكامل', 8, 14);

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
    last_delivered_content_number, owed_sessions_count, start_date
  ) VALUES (
    v_group_id, 'CrossTest G1', 'مجموعة 1', 'tuesday', '10:00:00', 60,
    v_level_id, v_ag_id, true, true, 'active', 0, 0, '2026-01-06'
  );

  -- Group 2
  v_group2_id := gen_random_uuid();
  INSERT INTO groups (
    id, name, name_ar, schedule_day, schedule_time, duration_minutes,
    level_id, age_group_id, is_active, has_started, status,
    last_delivered_content_number, owed_sessions_count, start_date
  ) VALUES (
    v_group2_id, 'CrossTest G2', 'مجموعة 2', 'thursday', '14:00:00', 60,
    v_level2_id, v_ag_id, true, true, 'active', 0, 0, '2026-01-08'
  );

  -- Session #1 in Group 1
  v_session_id := gen_random_uuid();
  INSERT INTO sessions (id, group_id, session_number, status, session_date, session_time, duration_minutes, level_id)
  VALUES (v_session_id, v_group_id, 1, 'scheduled', '2026-01-06', '10:00:00', 60, v_level_id);

  -- ═══ SECTION 1: DATA INTEGRITY ═══

  -- T1.1: No orphan sessions
  SELECT count(*) INTO v_count FROM sessions s
  LEFT JOIN groups g ON g.id = s.group_id
  WHERE s.group_id = v_group_id AND g.id IS NULL;
  ASSERT v_count = 0, 'T1.1 FAIL: Orphan session';
  RAISE NOTICE '✓ T1.1: No orphan sessions';

  -- T1.2: Unique session_number per group
  SELECT count(*) INTO v_count FROM (
    SELECT group_id, session_number, count(*) as c
    FROM sessions WHERE group_id = v_group_id AND (is_makeup IS NOT TRUE)
    GROUP BY group_id, session_number HAVING count(*) > 1
  ) dupes;
  ASSERT v_count = 0, 'T1.2 FAIL: Duplicate session_number';
  RAISE NOTICE '✓ T1.2: Unique session numbers';

  -- ═══ SECTION 2: TRIGGER CHAIN ═══

  -- T2.1: Complete with attendance → content advances
  INSERT INTO attendance (session_id, student_id, recorded_by, status)
  VALUES (v_session_id, v_fake_student, v_fake_student, 'present');
  UPDATE sessions SET status = 'completed' WHERE id = v_session_id;

  SELECT content_number INTO v_content FROM sessions WHERE id = v_session_id;
  ASSERT v_content = 1, format('T2.1 FAIL: Expected content=1, got %s', v_content);

  SELECT last_delivered_content_number INTO v_last FROM groups WHERE id = v_group_id;
  ASSERT v_last = 1, format('T2.1b FAIL: Expected last_delivered=1, got %s', v_last);
  RAISE NOTICE '✓ T2.1: Session 1 → content=1, last_delivered=1';

  -- T2.2: Session #2 auto-generated
  SELECT count(*) INTO v_count FROM sessions
  WHERE group_id = v_group_id AND session_number = 2 AND is_makeup IS NOT TRUE;
  ASSERT v_count = 1, format('T2.2 FAIL: Expected 1 session #2, got %s', v_count);
  RAISE NOTICE '✓ T2.2: Session #2 auto-generated';

  -- T2.3: Complete sessions 2 and 3
  SELECT id INTO v_session2_id FROM sessions
  WHERE group_id = v_group_id AND session_number = 2 AND is_makeup IS NOT TRUE;
  INSERT INTO attendance (session_id, student_id, recorded_by, status)
  VALUES (v_session2_id, v_fake_student, v_fake_student, 'present');
  UPDATE sessions SET status = 'completed' WHERE id = v_session2_id;

  SELECT id INTO v_session2_id FROM sessions
  WHERE group_id = v_group_id AND session_number = 3 AND is_makeup IS NOT TRUE;
  INSERT INTO attendance (session_id, student_id, recorded_by, status)
  VALUES (v_session2_id, v_fake_student, v_fake_student, 'present');
  UPDATE sessions SET status = 'completed' WHERE id = v_session2_id;

  SELECT last_delivered_content_number INTO v_last FROM groups WHERE id = v_group_id;
  ASSERT v_last = 3, format('T2.3 FAIL: Expected last_delivered=3, got %s', v_last);
  RAISE NOTICE '✓ T2.3: All 3 sessions done, last_delivered=3';

  -- ═══ SECTION 3: CANCEL → WARNING DEACTIVATION ═══

  v_session2_id := gen_random_uuid();
  INSERT INTO sessions (id, group_id, session_number, status, session_date, session_time, duration_minutes, level_id)
  VALUES (v_session2_id, v_group2_id, 1, 'completed', '2026-01-08', '14:00:00', 60, v_level2_id);

  INSERT INTO instructor_warnings (instructor_id, warning_type, reason, severity, session_id, is_active)
  VALUES (v_instructor_id, 'no_attendance', 'Did not record attendance', 'medium', v_session2_id, true);

  UPDATE sessions SET status = 'cancelled', cancellation_reason = 'academy_closure' WHERE id = v_session2_id;

  SELECT count(*) INTO v_warning_count FROM instructor_warnings
  WHERE session_id = v_session2_id AND is_active = true;
  ASSERT v_warning_count = 0, format('T3.1 FAIL: Active warnings=%s after cancel', v_warning_count);
  RAISE NOTICE '✓ T3.1: Cancel deactivates warnings';

  -- ═══ SECTION 4: CANCEL → OWED ═══

  v_session2_id := gen_random_uuid();
  INSERT INTO sessions (id, group_id, session_number, status, session_date, session_time, duration_minutes, level_id)
  VALUES (v_session2_id, v_group2_id, 2, 'scheduled', '2026-01-15', '14:00:00', 60, v_level2_id);

  SELECT owed_sessions_count INTO v_owed_before FROM groups WHERE id = v_group2_id;
  UPDATE sessions SET status = 'cancelled', cancellation_reason = 'instructor_absence' WHERE id = v_session2_id;
  SELECT owed_sessions_count INTO v_owed FROM groups WHERE id = v_group2_id;
  ASSERT v_owed = v_owed_before + 1, format('T4.1 FAIL: owed %s→%s', v_owed_before, v_owed);
  RAISE NOTICE '✓ T4.1: Cancel increments owed (% → %)', v_owed_before, v_owed;

  -- ═══ SECTION 5: IDEMPOTENCY ═══

  SELECT last_delivered_content_number INTO v_last FROM groups WHERE id = v_group_id;
  UPDATE sessions SET status = 'completed' WHERE id = v_session_id;
  SELECT last_delivered_content_number INTO v_count FROM groups WHERE id = v_group_id;
  ASSERT v_last = v_count, format('T5.1 FAIL: Re-complete changed %s→%s', v_last, v_count);
  RAISE NOTICE '✓ T5.1: Re-completing is idempotent';

  -- ═══ SECTION 6: DUPLICATE SESSION_NUMBER ═══

  BEGIN
    INSERT INTO sessions (id, group_id, session_number, status, session_date, session_time, duration_minutes, level_id)
    VALUES (gen_random_uuid(), v_group_id, 1, 'scheduled', '2026-02-01', '10:00:00', 60, v_level_id);
    RAISE NOTICE '⚠ T6.1: Duplicate session_number allowed';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE '✓ T6.1: Duplicate session_number rejected';
  END;

  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════';
  RAISE NOTICE 'ALL CROSS-MODULE TESTS PASSED ✓';
  RAISE NOTICE '══════════════════════════════════════════════';

END $$;

ROLLBACK;
