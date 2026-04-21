-- ============================================================================
-- STEP 1: Update trigger to handle MAKEUP attendance (create windows from makeup time)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_attendance_quiz_overrides()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_session RECORD;
  v_makeup RECORD;
  v_session_start TIMESTAMPTZ;
  v_session_end TIMESTAMPTZ;
  v_duration_min INTEGER;
  v_original_session_id UUID;
  v_qa RECORD;
  v_a RECORD;
BEGIN
  -- Only act on present/late
  IF NEW.status NOT IN ('present', 'late') THEN
    RETURN NEW;
  END IF;

  -- CASE A: Makeup attendance — anchor window to the makeup session's scheduled time
  IF NEW.makeup_session_id IS NOT NULL THEN
    SELECT ms.scheduled_date, ms.scheduled_time, ms.original_session_id,
           COALESCE(g.duration_minutes, 60) AS dur
      INTO v_makeup
    FROM public.makeup_sessions ms
    LEFT JOIN public.groups g ON g.id = ms.group_id
    WHERE ms.id = NEW.makeup_session_id;

    IF NOT FOUND OR v_makeup.scheduled_date IS NULL OR v_makeup.scheduled_time IS NULL THEN
      RETURN NEW;
    END IF;

    v_session_start := (v_makeup.scheduled_date::text || ' ' || v_makeup.scheduled_time::text)::timestamp AT TIME ZONE 'Africa/Cairo';
    v_duration_min := COALESCE(v_makeup.dur, 60);
    v_session_end := v_session_start + (v_duration_min || ' minutes')::interval;
    v_original_session_id := v_makeup.original_session_id;
  ELSE
    -- CASE B: Regular attendance on the original session
    SELECT s.session_date, s.session_time, s.group_id, COALESCE(g.duration_minutes, 60) AS dur
      INTO v_session
    FROM public.sessions s
    LEFT JOIN public.groups g ON g.id = s.group_id
    WHERE s.id = NEW.session_id;

    IF NOT FOUND THEN RETURN NEW; END IF;

    v_session_start := (v_session.session_date::text || ' ' || v_session.session_time::text)::timestamp AT TIME ZONE 'Africa/Cairo';
    v_duration_min := COALESCE(v_session.dur, 60);
    v_session_end := v_session_start + (v_duration_min || ' minutes')::interval;
    v_original_session_id := NEW.session_id;
  END IF;

  -- Create per-student windows for QUIZZES on the (original) session
  FOR v_qa IN
    SELECT id FROM public.quiz_assignments
    WHERE session_id = v_original_session_id
      AND is_active = true
      AND COALESCE(is_auto_generated, false) = false
  LOOP
    INSERT INTO public.quiz_assignment_overrides (
      quiz_assignment_id, student_id, start_time, due_date, source, makeup_session_id
    ) VALUES (
      v_qa.id, NEW.student_id, v_session_start, v_session_end,
      CASE WHEN NEW.makeup_session_id IS NOT NULL THEN 'makeup_auto' ELSE 'attendance_auto' END,
      NEW.makeup_session_id
    )
    ON CONFLICT (quiz_assignment_id, student_id)
    DO UPDATE SET
      start_time = EXCLUDED.start_time,
      due_date = EXCLUDED.due_date,
      source = EXCLUDED.source,
      makeup_session_id = EXCLUDED.makeup_session_id,
      updated_at = now()
    WHERE public.quiz_assignment_overrides.source <> 'manual';
  END LOOP;

  -- Create per-student windows for ASSIGNMENTS on the (original) session
  FOR v_a IN
    SELECT id FROM public.assignments
    WHERE session_id = v_original_session_id
      AND COALESCE(is_active, true) = true
      AND COALESCE(is_auto_generated, false) = false
  LOOP
    INSERT INTO public.assignment_overrides (
      assignment_id, student_id, due_date, source, makeup_session_id
    ) VALUES (
      v_a.id, NEW.student_id, v_session_end + interval '7 days',
      CASE WHEN NEW.makeup_session_id IS NOT NULL THEN 'makeup_auto' ELSE 'attendance_auto' END,
      NEW.makeup_session_id
    )
    ON CONFLICT (assignment_id, student_id)
    DO UPDATE SET
      due_date = EXCLUDED.due_date,
      source = EXCLUDED.source,
      makeup_session_id = EXCLUDED.makeup_session_id,
      updated_at = now()
    WHERE public.assignment_overrides.source <> 'manual';
  END LOOP;

  RETURN NEW;
END;
$function$;

-- ============================================================================
-- STEP 2: Visibility gate helper functions
-- ============================================================================

-- Returns true if the given student has access to the quiz_assignment
-- (either marked present/late on the original session, or has a per-student window)
CREATE OR REPLACE FUNCTION public.student_has_quiz_access(_quiz_assignment_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Has explicit per-student window (attendance_auto, makeup_auto, or manual)
    EXISTS (
      SELECT 1 FROM public.quiz_assignment_overrides qao
      WHERE qao.quiz_assignment_id = _quiz_assignment_id
        AND qao.student_id = _student_id
    )
    OR
    -- Marked present/late on the original session
    EXISTS (
      SELECT 1
      FROM public.quiz_assignments qa
      JOIN public.attendance a ON a.session_id = qa.session_id
      WHERE qa.id = _quiz_assignment_id
        AND a.student_id = _student_id
        AND a.status IN ('present', 'late')
        AND a.makeup_session_id IS NULL
    );
$$;

CREATE OR REPLACE FUNCTION public.student_has_assignment_access(_assignment_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.assignment_overrides ao
      WHERE ao.assignment_id = _assignment_id
        AND ao.student_id = _student_id
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.assignments asg
      JOIN public.attendance a ON a.session_id = asg.session_id
      WHERE asg.id = _assignment_id
        AND a.student_id = _student_id
        AND a.status IN ('present', 'late')
        AND a.makeup_session_id IS NULL
    );
$$;

-- ============================================================================
-- STEP 3: Replace student/parent visibility policies with per-student gate
-- ============================================================================

-- QUIZ ASSIGNMENTS
DROP POLICY IF EXISTS "Students can view their quiz assignments" ON public.quiz_assignments;

CREATE POLICY "Students can view their quiz assignments"
ON public.quiz_assignments
FOR SELECT
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND (
    -- Per-student assignment (always visible to that student)
    student_id = auth.uid()
    OR
    -- Group-wide assignment: only visible if student has access (attended original or has window via makeup)
    (
      group_id IS NOT NULL
      AND group_id IN (
        SELECT group_students.group_id
        FROM group_students
        WHERE group_students.student_id = auth.uid()
          AND group_students.is_active = true
      )
      AND public.student_has_quiz_access(id, auth.uid())
    )
  )
);

-- ASSIGNMENTS — Students
DROP POLICY IF EXISTS "Students can view their assignments" ON public.assignments;

CREATE POLICY "Students can view their assignments"
ON public.assignments
FOR SELECT
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND (
    student_id = auth.uid()
    OR
    (
      group_id IS NOT NULL
      AND group_id IN (
        SELECT group_students.group_id
        FROM group_students
        WHERE group_students.student_id = auth.uid()
          AND group_students.is_active = true
      )
      AND public.student_has_assignment_access(id, auth.uid())
    )
  )
);

-- ASSIGNMENTS — Parents (mirror the student gate for each linked child)
DROP POLICY IF EXISTS "Parents can view their children assignments" ON public.assignments;

CREATE POLICY "Parents can view their children assignments"
ON public.assignments
FOR SELECT
USING (
  has_role(auth.uid(), 'parent'::app_role)
  AND (
    student_id IN (
      SELECT ps.student_id FROM parent_students ps WHERE ps.parent_id = auth.uid()
    )
    OR
    (
      group_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM parent_students ps
        JOIN group_students gs ON gs.student_id = ps.student_id AND gs.is_active = true
        WHERE ps.parent_id = auth.uid()
          AND gs.group_id = assignments.group_id
          AND public.student_has_assignment_access(assignments.id, ps.student_id)
      )
    )
  )
);

-- ============================================================================
-- STEP 4: Backfill — generate windows for past makeup attendance records
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT a.*
    FROM public.attendance a
    WHERE a.makeup_session_id IS NOT NULL
      AND a.status IN ('present', 'late')
  LOOP
    -- Re-fire the trigger logic by issuing a no-op update
    UPDATE public.attendance
       SET status = status
     WHERE id = r.id;
  END LOOP;
END $$;