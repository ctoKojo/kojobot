
-- ============================================================
-- 1. Add status_changed_at column to group_student_progress
-- ============================================================
ALTER TABLE public.group_student_progress
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ DEFAULT now();

-- Backfill existing rows
UPDATE public.group_student_progress SET status_changed_at = COALESCE(updated_at, created_at);

-- Partial index for pending_group_assignment dashboard queries
CREATE INDEX IF NOT EXISTS idx_gsp_pending_assignment
  ON public.group_student_progress (status, status_changed_at)
  WHERE status = 'pending_group_assignment';

-- Index for SLA queries
CREATE INDEX IF NOT EXISTS idx_gsp_sla_awaiting
  ON public.group_student_progress (status, status_changed_at)
  WHERE status IN ('awaiting_exam', 'exam_scheduled');

-- ============================================================
-- 2. Modify check_students_level_completion
--    REMOVE early group removal (is_active = false)
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_students_level_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student RECORD;
  v_expected_sessions INTEGER;
  v_last_content INTEGER;
  v_owed INTEGER;
  v_student_name TEXT;
  v_level_name TEXT;
  v_group_name TEXT;
BEGIN
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  IF NEW.level_id IS NULL OR NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT l.expected_sessions_count INTO v_expected_sessions
  FROM levels l WHERE l.id = NEW.level_id;

  IF v_expected_sessions IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT g.last_delivered_content_number, g.owed_sessions_count
  INTO v_last_content, v_owed
  FROM groups g WHERE g.id = NEW.group_id;

  IF v_last_content < v_expected_sessions OR v_owed > 0 THEN
    RETURN NEW;
  END IF;

  SELECT l.name INTO v_level_name FROM levels l WHERE l.id = NEW.level_id;
  SELECT g.name INTO v_group_name FROM groups g WHERE g.id = NEW.group_id;

  FOR v_student IN
    SELECT a.student_id
    FROM attendance a
    WHERE a.session_id = NEW.id
      AND a.status IN ('present', 'late')
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM group_student_progress gsp
      WHERE gsp.student_id = v_student.student_id
        AND gsp.group_id = NEW.group_id
        AND gsp.status = 'in_progress'
    ) THEN
      CONTINUE;
    END IF;

    -- Update progress status to awaiting_exam
    -- NOTE: Student STAYS in group (is_active remains true)
    UPDATE group_student_progress
    SET status = 'awaiting_exam',
        status_changed_at = now(),
        updated_at = now()
    WHERE student_id = v_student.student_id AND group_id = NEW.group_id;

    SELECT p.full_name INTO v_student_name
    FROM profiles p WHERE p.user_id = v_student.student_id;

    INSERT INTO notifications (user_id, title, title_ar, message, message_ar, type, category, action_url)
    SELECT
      ur.user_id,
      'Student Ready for Final Exam',
      'طالب جاهز للامتحان النهائي',
      COALESCE(v_student_name, 'Student') || ' completed ' || COALESCE(v_level_name, 'level') || ' in ' || COALESCE(v_group_name, 'group'),
      COALESCE(v_student_name, 'طالب') || ' أكمل ' || COALESCE(v_level_name, 'المستوى') || ' في ' || COALESCE(v_group_name, 'المجموعة'),
      'info',
      'system',
      '/final-exams'
    FROM user_roles ur
    WHERE ur.role IN ('admin', 'reception');
  END LOOP;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- 3. Modify mark_student_repeat - reactivate student in group
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_student_repeat(p_student_id uuid, p_group_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_level_id UUID;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT current_level_id INTO v_current_level_id
  FROM group_student_progress
  WHERE group_id = p_group_id AND student_id = p_student_id
  FOR UPDATE;

  IF v_current_level_id IS NULL THEN
    RAISE EXCEPTION 'Student progress not found';
  END IF;

  -- Log transition
  INSERT INTO student_level_transitions (student_id, group_id, from_level_id, to_level_id, reason, created_by)
  VALUES (p_student_id, p_group_id, v_current_level_id, v_current_level_id, 'repeat', auth.uid());

  -- Reset progress
  UPDATE group_student_progress
  SET outcome = 'repeat',
    status = 'in_progress',
    status_changed_at = now(),
    level_started_at = now(),
    exam_scheduled_at = NULL,
    exam_submitted_at = NULL,
    graded_at = NULL,
    updated_at = now()
  WHERE group_id = p_group_id AND student_id = p_student_id;

  -- Reactivate student in group (was deactivated or stayed)
  UPDATE group_students
  SET is_active = true
  WHERE student_id = p_student_id AND group_id = p_group_id;

  RETURN jsonb_build_object('repeated', true);
END;
$function$;

-- ============================================================
-- 4. Modify upgrade_student_level - pending_group_assignment + deactivate
-- ============================================================
CREATE OR REPLACE FUNCTION public.upgrade_student_level(p_student_id uuid, p_group_id uuid, p_chosen_track_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_progress RECORD;
  v_next_level_id UUID;
  v_current_level_order INTEGER;
  v_student_name TEXT;
  v_level_name TEXT;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT * INTO v_progress
  FROM group_student_progress
  WHERE group_id = p_group_id AND student_id = p_student_id
  FOR UPDATE;

  IF v_progress IS NULL THEN
    RAISE EXCEPTION 'Student progress not found';
  END IF;

  IF v_progress.outcome != 'passed' THEN
    RAISE EXCEPTION 'Student has not passed the current level';
  END IF;

  -- Determine next level
  IF p_chosen_track_id IS NOT NULL THEN
    SELECT id INTO v_next_level_id
    FROM levels
    WHERE parent_level_id = v_progress.current_level_id
      AND track_id = p_chosen_track_id
      AND is_active = true
    LIMIT 1;

    IF v_next_level_id IS NULL THEN
      RAISE EXCEPTION 'No matching level found for this track';
    END IF;

    INSERT INTO student_track_choices (student_id, group_id, from_level_id, chosen_track_id, chosen_by)
    VALUES (p_student_id, p_group_id, v_progress.current_level_id, p_chosen_track_id, auth.uid())
    ON CONFLICT (student_id, group_id, from_level_id) DO NOTHING;
  ELSE
    SELECT l.level_order INTO v_current_level_order
    FROM levels l WHERE l.id = v_progress.current_level_id;

    SELECT id INTO v_next_level_id
    FROM levels
    WHERE level_order = v_current_level_order + 1
      AND (track_id = v_progress.current_track_id OR (track_id IS NULL AND v_progress.current_track_id IS NULL))
      AND is_active = true
    LIMIT 1;

    IF v_next_level_id IS NULL THEN
      RETURN jsonb_build_object('upgraded', false, 'reason', 'no_next_level');
    END IF;
  END IF;

  -- 1. Log transition
  INSERT INTO student_level_transitions (student_id, group_id, from_level_id, to_level_id, reason, created_by)
  VALUES (p_student_id, p_group_id, v_progress.current_level_id, v_next_level_id, 'passed', auth.uid());

  -- 2. Update progress - set to pending_group_assignment (not in_progress)
  UPDATE group_student_progress
  SET level_completed_at = now(),
    current_level_id = v_next_level_id,
    current_track_id = COALESCE(p_chosen_track_id, current_track_id),
    status = 'pending_group_assignment',
    status_changed_at = now(),
    outcome = NULL,
    level_started_at = now(),
    exam_scheduled_at = NULL,
    exam_submitted_at = NULL,
    graded_at = NULL,
    updated_at = now()
  WHERE group_id = p_group_id AND student_id = p_student_id;

  -- 3. Deactivate from old group
  UPDATE group_students
  SET is_active = false
  WHERE student_id = p_student_id AND group_id = p_group_id;

  -- 4. Update profile level
  UPDATE profiles SET level_id = v_next_level_id, updated_at = now()
  WHERE user_id = p_student_id;

  -- 5. Notify admin
  SELECT p.full_name INTO v_student_name FROM profiles p WHERE p.user_id = p_student_id;
  SELECT l.name INTO v_level_name FROM levels l WHERE l.id = v_next_level_id;

  INSERT INTO notifications (user_id, title, title_ar, message, message_ar, type, category, action_url)
  SELECT
    ur.user_id,
    'Student Needs Group Assignment',
    'طالب يحتاج تعيين في جروب',
    COALESCE(v_student_name, 'Student') || ' upgraded to ' || COALESCE(v_level_name, 'next level') || ' — needs group assignment',
    COALESCE(v_student_name, 'طالب') || ' ترقى إلى ' || COALESCE(v_level_name, 'المستوى التالي') || ' — يحتاج تعيين في جروب',
    'warning',
    'system',
    '/students/' || p_student_id
  FROM user_roles ur
  WHERE ur.role IN ('admin', 'reception');

  RETURN jsonb_build_object('upgraded', true, 'next_level_id', v_next_level_id);
END;
$function$;

-- ============================================================
-- 5. Modify student_choose_track_and_upgrade - same logic
-- ============================================================
CREATE OR REPLACE FUNCTION public.student_choose_track_and_upgrade(p_group_id uuid, p_chosen_track_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student_id UUID;
  v_progress RECORD;
  v_next_level_id UUID;
  v_current_level_order INTEGER;
  v_has_branching BOOLEAN;
  v_student_name TEXT;
  v_level_name TEXT;
BEGIN
  v_student_id := auth.uid();

  IF NOT has_role(v_student_id, 'student'::app_role) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT * INTO v_progress
  FROM group_student_progress
  WHERE group_id = p_group_id AND student_id = v_student_id
  FOR UPDATE;

  IF v_progress IS NULL THEN
    RAISE EXCEPTION 'Progress record not found';
  END IF;

  IF v_progress.outcome != 'passed' THEN
    RAISE EXCEPTION 'Student has not passed the current level';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM levels
    WHERE parent_level_id = v_progress.current_level_id
      AND track_id IS NOT NULL
      AND is_active = true
  ) INTO v_has_branching;

  IF v_has_branching AND p_chosen_track_id IS NOT NULL THEN
    SELECT id INTO v_next_level_id
    FROM levels
    WHERE parent_level_id = v_progress.current_level_id
      AND track_id = p_chosen_track_id
      AND is_active = true
    LIMIT 1;

    IF v_next_level_id IS NULL THEN
      RAISE EXCEPTION 'No matching level found for this track';
    END IF;

    INSERT INTO student_track_choices (student_id, group_id, from_level_id, chosen_track_id, chosen_by)
    VALUES (v_student_id, p_group_id, v_progress.current_level_id, p_chosen_track_id, v_student_id)
    ON CONFLICT (student_id, group_id, from_level_id) DO NOTHING;
  ELSE
    SELECT l.level_order INTO v_current_level_order
    FROM levels l WHERE l.id = v_progress.current_level_id;

    SELECT id INTO v_next_level_id
    FROM levels
    WHERE level_order = v_current_level_order + 1
      AND (track_id = v_progress.current_track_id OR (track_id IS NULL AND v_progress.current_track_id IS NULL))
      AND is_active = true
    LIMIT 1;

    IF v_next_level_id IS NULL THEN
      RETURN jsonb_build_object('upgraded', false, 'reason', 'no_next_level');
    END IF;
  END IF;

  -- 1. Log transition
  INSERT INTO student_level_transitions (student_id, group_id, from_level_id, to_level_id, reason, created_by)
  VALUES (v_student_id, p_group_id, v_progress.current_level_id, v_next_level_id, 'passed', v_student_id);

  -- 2. Update progress - pending_group_assignment
  UPDATE group_student_progress
  SET level_completed_at = now(),
    current_level_id = v_next_level_id,
    current_track_id = COALESCE(p_chosen_track_id, current_track_id),
    status = 'pending_group_assignment',
    status_changed_at = now(),
    outcome = NULL,
    level_started_at = now(),
    exam_scheduled_at = NULL,
    exam_submitted_at = NULL,
    graded_at = NULL,
    updated_at = now()
  WHERE group_id = p_group_id AND student_id = v_student_id;

  -- 3. Deactivate from old group
  UPDATE group_students
  SET is_active = false
  WHERE student_id = v_student_id AND group_id = p_group_id;

  -- 4. Update profile level
  UPDATE profiles SET level_id = v_next_level_id, updated_at = now()
  WHERE user_id = v_student_id;

  -- 5. Notify admin
  SELECT p.full_name INTO v_student_name FROM profiles p WHERE p.user_id = v_student_id;
  SELECT l.name INTO v_level_name FROM levels l WHERE l.id = v_next_level_id;

  INSERT INTO notifications (user_id, title, title_ar, message, message_ar, type, category, action_url)
  SELECT
    ur.user_id,
    'Student Needs Group Assignment',
    'طالب يحتاج تعيين في جروب',
    COALESCE(v_student_name, 'Student') || ' upgraded to ' || COALESCE(v_level_name, 'next level') || ' — needs group assignment',
    COALESCE(v_student_name, 'طالب') || ' ترقى إلى ' || COALESCE(v_level_name, 'المستوى التالي') || ' — يحتاج تعيين في جروب',
    'warning',
    'system',
    '/students/' || v_student_id
  FROM user_roles ur
  WHERE ur.role IN ('admin', 'reception');

  RETURN jsonb_build_object('upgraded', true, 'next_level_id', v_next_level_id);
END;
$function$;

-- ============================================================
-- 6. New RPC: assign_student_to_group (atomic transaction)
-- ============================================================
CREATE OR REPLACE FUNCTION public.assign_student_to_group(
  p_student_id UUID,
  p_new_group_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_progress RECORD;
  v_group RECORD;
  v_student_name TEXT;
  v_group_name TEXT;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) AND NOT has_role(auth.uid(), 'reception'::app_role) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Lock progress record
  SELECT * INTO v_progress
  FROM group_student_progress
  WHERE student_id = p_student_id
    AND status = 'pending_group_assignment'
  ORDER BY updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_progress IS NULL THEN
    RAISE EXCEPTION 'No pending group assignment found for this student';
  END IF;

  -- Verify new group exists, is active, and has same level
  SELECT * INTO v_group
  FROM groups
  WHERE id = p_new_group_id
    AND is_active = true
    AND status = 'active'
  FOR UPDATE;

  IF v_group IS NULL THEN
    RAISE EXCEPTION 'Target group not found or inactive';
  END IF;

  IF v_group.level_id != v_progress.current_level_id THEN
    RAISE EXCEPTION 'Group level does not match student level';
  END IF;

  -- Advisory lock on new group to prevent race conditions
  PERFORM pg_advisory_xact_lock(hashtext(p_new_group_id::text));

  -- 1. Add student to new group
  INSERT INTO group_students (group_id, student_id, is_active)
  VALUES (p_new_group_id, p_student_id, true)
  ON CONFLICT (group_id, student_id)
  DO UPDATE SET is_active = true, joined_at = now();

  -- 2. Create new progress record for the new group
  INSERT INTO group_student_progress (group_id, student_id, current_level_id, current_track_id, status, status_changed_at, level_started_at)
  VALUES (p_new_group_id, p_student_id, v_progress.current_level_id, v_progress.current_track_id, 'in_progress', now(), now());

  -- 3. Mark old progress as completed
  UPDATE group_student_progress
  SET status = 'in_progress',
    status_changed_at = now(),
    updated_at = now()
  WHERE id = v_progress.id;

  -- Get names for notification
  SELECT p.full_name INTO v_student_name FROM profiles p WHERE p.user_id = p_student_id;
  SELECT g.name INTO v_group_name FROM groups g WHERE g.id = p_new_group_id;

  -- Notify student
  INSERT INTO notifications (user_id, title, title_ar, message, message_ar, type, category, action_url)
  VALUES (
    p_student_id,
    'You have been assigned to a new group!',
    'تم تعيينك في جروب جديد!',
    'You are now in group ' || COALESCE(v_group_name, 'new group'),
    'أنت الآن في جروب ' || COALESCE(v_group_name, 'جديد'),
    'success',
    'system',
    '/dashboard'
  );

  RETURN jsonb_build_object('assigned', true, 'group_id', p_new_group_id, 'group_name', v_group_name);
END;
$function$;

-- ============================================================
-- 7. Auto-compute grades trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_compute_grades_on_final_exam()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_quiz_assignment RECORD;
  v_quiz RECORD;
  v_group_id UUID;
  v_level_id UUID;
  v_expected_count INTEGER;
  v_submitted_count INTEGER;
  v_pass_threshold NUMERIC;
  v_count INTEGER;
BEGIN
  -- Only on submitted status
  IF NEW.status != 'submitted' THEN
    RETURN NEW;
  END IF;

  -- Get quiz assignment details
  SELECT qa.* INTO v_quiz_assignment
  FROM quiz_assignments qa
  WHERE qa.id = NEW.quiz_assignment_id;

  IF v_quiz_assignment IS NULL OR v_quiz_assignment.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_group_id := v_quiz_assignment.group_id;

  -- Check if this quiz is a final exam
  SELECT l.id, l.pass_threshold INTO v_level_id, v_pass_threshold
  FROM levels l
  WHERE l.final_exam_quiz_id = v_quiz_assignment.quiz_id
    AND l.is_active = true
  LIMIT 1;

  IF v_level_id IS NULL THEN
    RETURN NEW; -- Not a final exam quiz
  END IF;

  -- Advisory lock on group
  PERFORM pg_advisory_xact_lock(hashtext(v_group_id::text));

  -- Count expected students (those in exam_scheduled for this group)
  SELECT COUNT(*) INTO v_expected_count
  FROM group_student_progress gsp
  WHERE gsp.group_id = v_group_id
    AND gsp.status = 'exam_scheduled';

  -- Count submitted students
  SELECT COUNT(DISTINCT qs.student_id) INTO v_submitted_count
  FROM quiz_submissions qs
  JOIN quiz_assignments qa ON qa.id = qs.quiz_assignment_id
  WHERE qa.quiz_id = v_quiz_assignment.quiz_id
    AND qa.group_id = v_group_id
    AND qs.status = 'submitted';

  -- Only auto-compute if ALL expected students have submitted
  IF v_submitted_count < v_expected_count OR v_expected_count = 0 THEN
    RETURN NEW;
  END IF;

  v_pass_threshold := COALESCE(v_pass_threshold, 50);

  -- Auto-compute grades (same logic as compute_level_grades_batch but without auth check)
  WITH eval_avgs AS (
    SELECT se.student_id,
      ROUND(AVG(se.percentage)) as evaluation_avg
    FROM session_evaluations se
    JOIN sessions s ON s.id = se.session_id
    WHERE s.group_id = v_group_id
      AND s.level_id = v_level_id
      AND s.status = 'completed'
    GROUP BY se.student_id
  ),
  exam_scores AS (
    SELECT qs.student_id,
      qs.percentage as final_exam_score
    FROM quiz_submissions qs
    JOIN quiz_assignments qa ON qa.id = qs.quiz_assignment_id
    WHERE qa.quiz_id = v_quiz_assignment.quiz_id
      AND qa.group_id = v_group_id
      AND qs.status = 'submitted'
      AND qs.submitted_at = (
        SELECT MAX(qs2.submitted_at)
        FROM quiz_submissions qs2
        WHERE qs2.quiz_assignment_id = qs.quiz_assignment_id
          AND qs2.student_id = qs.student_id
          AND qs2.status = 'submitted'
      )
  )
  INSERT INTO level_grades (student_id, group_id, level_id, evaluation_avg, final_exam_score, outcome)
  SELECT ea.student_id, v_group_id, v_level_id,
    ea.evaluation_avg, es.final_exam_score,
    CASE WHEN ((COALESCE(ea.evaluation_avg,0) + COALESCE(es.final_exam_score,0)) / 2.0) >= v_pass_threshold
      THEN 'passed' ELSE 'failed' END
  FROM eval_avgs ea
  LEFT JOIN exam_scores es ON es.student_id = ea.student_id
  ON CONFLICT (student_id, group_id, level_id)
  DO UPDATE SET
    evaluation_avg = EXCLUDED.evaluation_avg,
    final_exam_score = EXCLUDED.final_exam_score,
    outcome = EXCLUDED.outcome,
    updated_at = now();

  -- Update progress for graded students
  UPDATE group_student_progress gsp
  SET status = 'graded',
    outcome = lg.outcome,
    status_changed_at = now(),
    graded_at = now(),
    updated_at = now()
  FROM level_grades lg
  WHERE lg.group_id = v_group_id
    AND lg.level_id = v_level_id
    AND lg.student_id = gsp.student_id
    AND gsp.group_id = v_group_id
    AND gsp.status = 'exam_scheduled';

  -- Update group status
  UPDATE groups SET level_status = 'grades_computed' WHERE id = v_group_id;

  RETURN NEW;
END;
$function$;

-- Create the trigger
DROP TRIGGER IF EXISTS auto_compute_grades_trigger ON quiz_submissions;
CREATE TRIGGER auto_compute_grades_trigger
  AFTER INSERT OR UPDATE ON quiz_submissions
  FOR EACH ROW
  EXECUTE FUNCTION auto_compute_grades_on_final_exam();

-- ============================================================
-- 8. SLA timeout check function
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_exam_sla_timeouts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_student RECORD;
  v_count INTEGER := 0;
  v_student_name TEXT;
  v_level_name TEXT;
  v_group_name TEXT;
  v_days INTEGER;
BEGIN
  -- Check awaiting_exam > 7 days
  FOR v_student IN
    SELECT gsp.student_id, gsp.group_id, gsp.current_level_id, gsp.status_changed_at
    FROM group_student_progress gsp
    WHERE gsp.status = 'awaiting_exam'
      AND gsp.status_changed_at < now() - interval '7 days'
  LOOP
    v_days := EXTRACT(DAY FROM (now() - v_student.status_changed_at));

    -- Idempotency: check if notification sent in last 24h
    IF EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.category = 'sla_timeout'
        AND n.action_url = '/final-exams'
        AND n.message LIKE '%' || v_student.student_id::text || '%'
        AND n.created_at > now() - interval '24 hours'
    ) THEN
      CONTINUE;
    END IF;

    SELECT p.full_name INTO v_student_name FROM profiles p WHERE p.user_id = v_student.student_id;
    SELECT l.name INTO v_level_name FROM levels l WHERE l.id = v_student.current_level_id;
    SELECT g.name INTO v_group_name FROM groups g WHERE g.id = v_student.group_id;

    INSERT INTO notifications (user_id, title, title_ar, message, message_ar, type, category, action_url)
    SELECT
      ur.user_id,
      '⚠️ Exam SLA Exceeded',
      '⚠️ تأخر موعد الامتحان',
      COALESCE(v_student_name, 'Student') || ' waiting ' || v_days || ' days for exam (' || COALESCE(v_level_name, '') || ' / ' || COALESCE(v_group_name, '') || ') [' || v_student.student_id || ']',
      COALESCE(v_student_name, 'طالب') || ' ينتظر ' || v_days || ' يوم للامتحان (' || COALESCE(v_level_name, '') || ' / ' || COALESCE(v_group_name, '') || ')',
      'warning',
      'sla_timeout',
      '/final-exams'
    FROM user_roles ur
    WHERE ur.role IN ('admin', 'reception');

    v_count := v_count + 1;
  END LOOP;

  -- Check exam_scheduled > 14 days without submission
  FOR v_student IN
    SELECT gsp.student_id, gsp.group_id, gsp.current_level_id, gsp.status_changed_at
    FROM group_student_progress gsp
    WHERE gsp.status = 'exam_scheduled'
      AND gsp.status_changed_at < now() - interval '14 days'
  LOOP
    v_days := EXTRACT(DAY FROM (now() - v_student.status_changed_at));

    IF EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.category = 'sla_timeout'
        AND n.action_url = '/final-exams'
        AND n.message LIKE '%' || v_student.student_id::text || '%scheduled%'
        AND n.created_at > now() - interval '24 hours'
    ) THEN
      CONTINUE;
    END IF;

    SELECT p.full_name INTO v_student_name FROM profiles p WHERE p.user_id = v_student.student_id;
    SELECT l.name INTO v_level_name FROM levels l WHERE l.id = v_student.current_level_id;
    SELECT g.name INTO v_group_name FROM groups g WHERE g.id = v_student.group_id;

    INSERT INTO notifications (user_id, title, title_ar, message, message_ar, type, category, action_url)
    SELECT
      ur.user_id,
      '🚨 Exam Submission Overdue',
      '🚨 تأخر تسليم الامتحان',
      COALESCE(v_student_name, 'Student') || ' scheduled ' || v_days || ' days ago, no submission (' || COALESCE(v_level_name, '') || ' / ' || COALESCE(v_group_name, '') || ') [' || v_student.student_id || ' scheduled]',
      COALESCE(v_student_name, 'طالب') || ' مجدول منذ ' || v_days || ' يوم بدون تسليم (' || COALESCE(v_level_name, '') || ' / ' || COALESCE(v_group_name, '') || ')',
      'destructive',
      'sla_timeout',
      '/final-exams'
    FROM user_roles ur
    WHERE ur.role IN ('admin', 'reception');

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('sla_alerts_sent', v_count);
END;
$function$;
