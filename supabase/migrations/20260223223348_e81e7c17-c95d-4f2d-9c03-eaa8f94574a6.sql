
-- ============================================================
-- LEVEL COMPLETION & INDIVIDUAL STUDENT PROGRESS SYSTEM
-- ============================================================

-- ==================== 1. NEW TABLES ====================

-- 1.1 Tracks table
CREATE TABLE public.tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed data from existing levels.track values
INSERT INTO public.tracks (name, name_ar) VALUES
  ('software', 'برمجيات'),
  ('hardware', 'هاردوير');

-- 1.2 group_student_progress
CREATE TABLE public.group_student_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  current_level_id UUID NOT NULL REFERENCES public.levels(id),
  current_track_id UUID REFERENCES public.tracks(id),
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','awaiting_exam','exam_scheduled','graded','paused')),
  outcome TEXT CHECK (outcome IS NULL OR outcome IN ('passed','failed','repeat')),
  level_started_at TIMESTAMPTZ DEFAULT now(),
  level_completed_at TIMESTAMPTZ,
  next_level_id UUID REFERENCES public.levels(id),
  exam_scheduled_at TIMESTAMPTZ,
  exam_submitted_at TIMESTAMPTZ,
  graded_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (group_id, student_id)
);

-- 1.3 level_grades
CREATE TABLE public.level_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  level_id UUID NOT NULL REFERENCES public.levels(id),
  evaluation_avg NUMERIC,
  final_exam_score NUMERIC,
  total_score NUMERIC GENERATED ALWAYS AS (COALESCE(evaluation_avg,0) + COALESCE(final_exam_score,0)) STORED,
  percentage NUMERIC GENERATED ALWAYS AS ((COALESCE(evaluation_avg,0) + COALESCE(final_exam_score,0)) / 2.0) STORED,
  outcome TEXT CHECK (outcome IS NULL OR outcome IN ('passed','failed','repeat')),
  graded_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, group_id, level_id)
);

-- 1.4 student_track_choices
CREATE TABLE public.student_track_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  from_level_id UUID NOT NULL REFERENCES public.levels(id),
  chosen_track_id UUID NOT NULL REFERENCES public.tracks(id),
  chosen_at TIMESTAMPTZ DEFAULT now(),
  chosen_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, group_id, from_level_id)
);

-- 1.5 student_level_transitions
CREATE TABLE public.student_level_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  from_level_id UUID NOT NULL REFERENCES public.levels(id),
  to_level_id UUID NOT NULL REFERENCES public.levels(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID NOT NULL
);

-- ==================== 2. ALTER EXISTING TABLES ====================

-- 2.1 sessions.level_id
ALTER TABLE public.sessions ADD COLUMN level_id UUID REFERENCES public.levels(id);

-- Backfill existing sessions
UPDATE public.sessions s SET level_id = g.level_id
FROM public.groups g WHERE s.group_id = g.id AND s.level_id IS NULL;

-- 2.2 levels: final_exam_quiz_id, pass_threshold, track_id
ALTER TABLE public.levels
  ADD COLUMN final_exam_quiz_id UUID REFERENCES public.quizzes(id),
  ADD COLUMN pass_threshold NUMERIC DEFAULT 50,
  ADD COLUMN track_id UUID REFERENCES public.tracks(id);

-- Migrate existing track TEXT to track_id FK
UPDATE public.levels l SET track_id = t.id
FROM public.tracks t WHERE l.track = t.name AND l.track IS NOT NULL;

-- 2.3 groups.level_status
ALTER TABLE public.groups
  ADD COLUMN level_status TEXT DEFAULT 'in_progress'
    CHECK (level_status IN ('in_progress','sessions_completed','exam_scheduled','exam_done','grades_computed'));

-- ==================== 3. INDEXES ====================

-- Idempotent quiz assignment scheduling
CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_assignment_student_quiz_group
ON public.quiz_assignments (quiz_id, student_id, group_id)
WHERE student_id IS NOT NULL AND group_id IS NOT NULL;

-- Performance indexes
CREATE INDEX idx_gsp_group ON public.group_student_progress(group_id);
CREATE INDEX idx_gsp_student ON public.group_student_progress(student_id);
CREATE INDEX idx_level_grades_group ON public.level_grades(group_id);
CREATE INDEX idx_level_grades_student ON public.level_grades(student_id);
CREATE INDEX idx_sessions_level ON public.sessions(level_id);
CREATE INDEX idx_slt_student ON public.student_level_transitions(student_id);

-- ==================== 4. TRIGGERS ====================

-- 4.1 updated_at triggers
CREATE TRIGGER update_gsp_updated_at
BEFORE UPDATE ON public.group_student_progress
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_level_grades_updated_at
BEFORE UPDATE ON public.level_grades
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4.2 Auto-create progress when student joins group
CREATE OR REPLACE FUNCTION public.auto_create_student_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level_id UUID;
BEGIN
  SELECT level_id INTO v_level_id FROM groups WHERE id = NEW.group_id;
  
  IF v_level_id IS NOT NULL THEN
    INSERT INTO group_student_progress (group_id, student_id, current_level_id)
    VALUES (NEW.group_id, NEW.student_id, v_level_id)
    ON CONFLICT (group_id, student_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_create_student_progress
AFTER INSERT ON public.group_students
FOR EACH ROW EXECUTE FUNCTION public.auto_create_student_progress();

-- 4.3 Modify auto_generate_next_session to include level_id
CREATE OR REPLACE FUNCTION public.auto_generate_next_session()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  next_session_number integer;
  next_session_date date;
  group_record RECORD;
  existing_next RECORD;
  v_expected_sessions integer;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    IF NEW.session_number IS NULL THEN
      RETURN NEW;
    END IF;

    -- Check against level's expected_sessions_count instead of hardcoded 12
    SELECT l.expected_sessions_count INTO v_expected_sessions
    FROM groups g JOIN levels l ON g.level_id = l.id
    WHERE g.id = NEW.group_id;

    v_expected_sessions := COALESCE(v_expected_sessions, 12);

    IF NEW.session_number >= v_expected_sessions THEN
      RETURN NEW;
    END IF;

    next_session_number := NEW.session_number + 1;

    SELECT id INTO existing_next
    FROM sessions
    WHERE group_id = NEW.group_id AND session_number = next_session_number
    LIMIT 1;

    IF existing_next.id IS NOT NULL THEN
      RETURN NEW;
    END IF;

    SELECT is_active, schedule_time, duration_minutes, level_id INTO group_record
    FROM groups WHERE id = NEW.group_id;

    IF NOT group_record.is_active THEN
      RETURN NEW;
    END IF;

    next_session_date := NEW.session_date + 7;

    INSERT INTO sessions (
      group_id, session_date, session_time, duration_minutes, status, session_number, level_id
    ) VALUES (
      NEW.group_id, next_session_date, group_record.schedule_time, group_record.duration_minutes,
      'scheduled', next_session_number, group_record.level_id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ==================== 5. RLS ====================

-- 5.1 tracks
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view tracks"
ON public.tracks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage tracks"
ON public.tracks FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 5.2 group_student_progress
ALTER TABLE public.group_student_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to gsp"
ON public.group_student_progress FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors view their group progress"
ON public.group_student_progress FOR SELECT TO authenticated
USING (group_id IN (SELECT get_instructor_group_ids(auth.uid())));

CREATE POLICY "Students view own progress"
ON public.group_student_progress FOR SELECT TO authenticated
USING (student_id = auth.uid());

CREATE POLICY "Reception view all progress"
ON public.group_student_progress FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'reception'::app_role));

-- 5.3 level_grades
ALTER TABLE public.level_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to level_grades"
ON public.level_grades FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors view group level_grades"
ON public.level_grades FOR SELECT TO authenticated
USING (group_id IN (SELECT get_instructor_group_ids(auth.uid())));

CREATE POLICY "Students view own level_grades"
ON public.level_grades FOR SELECT TO authenticated
USING (student_id = auth.uid());

CREATE POLICY "Reception view all level_grades"
ON public.level_grades FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'reception'::app_role));

-- 5.4 student_track_choices
ALTER TABLE public.student_track_choices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to track_choices"
ON public.student_track_choices FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors view group track_choices"
ON public.student_track_choices FOR SELECT TO authenticated
USING (group_id IN (SELECT get_instructor_group_ids(auth.uid())));

CREATE POLICY "Students view own track_choices"
ON public.student_track_choices FOR SELECT TO authenticated
USING (student_id = auth.uid());

-- 5.5 student_level_transitions
ALTER TABLE public.student_level_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to transitions"
ON public.student_level_transitions FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Instructors view group transitions"
ON public.student_level_transitions FOR SELECT TO authenticated
USING (group_id IN (SELECT get_instructor_group_ids(auth.uid())));

CREATE POLICY "Students view own transitions"
ON public.student_level_transitions FOR SELECT TO authenticated
USING (student_id = auth.uid());

-- ==================== 6. RPCs ====================

-- 6.1 create_level_final_exam
CREATE OR REPLACE FUNCTION public.create_level_final_exam(p_level_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level RECORD;
  v_quiz_id UUID;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT id, name, name_ar, final_exam_quiz_id INTO v_level
  FROM levels WHERE id = p_level_id FOR UPDATE;

  IF v_level IS NULL THEN
    RAISE EXCEPTION 'Level not found';
  END IF;

  IF v_level.final_exam_quiz_id IS NOT NULL THEN
    RAISE EXCEPTION 'Level already has a final exam';
  END IF;

  INSERT INTO quizzes (title, title_ar, created_by, duration_minutes, passing_score)
  VALUES (
    'Final Exam - ' || v_level.name,
    'امتحان نهائي - ' || v_level.name_ar,
    auth.uid(), 60, 60
  )
  RETURNING id INTO v_quiz_id;

  UPDATE levels SET final_exam_quiz_id = v_quiz_id WHERE id = p_level_id;

  RETURN jsonb_build_object('quiz_id', v_quiz_id);
END;
$$;

-- 6.2 get_group_level_status
CREATE OR REPLACE FUNCTION public.get_group_level_status(p_group_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_students', COUNT(*),
    'in_progress', COUNT(*) FILTER (WHERE status = 'in_progress'),
    'awaiting_exam', COUNT(*) FILTER (WHERE status = 'awaiting_exam'),
    'exam_scheduled', COUNT(*) FILTER (WHERE status = 'exam_scheduled'),
    'graded', COUNT(*) FILTER (WHERE status = 'graded'),
    'passed', COUNT(*) FILTER (WHERE outcome = 'passed'),
    'failed', COUNT(*) FILTER (WHERE outcome = 'failed'),
    'repeat', COUNT(*) FILTER (WHERE outcome = 'repeat'),
    'exam_submitted', COUNT(*) FILTER (WHERE exam_submitted_at IS NOT NULL AND status = 'exam_scheduled')
  ) INTO v_result
  FROM group_student_progress
  WHERE group_id = p_group_id;

  RETURN v_result;
END;
$$;

-- 6.3 schedule_final_exam_for_students
CREATE OR REPLACE FUNCTION public.schedule_final_exam_for_students(
  p_group_id UUID,
  p_student_ids UUID[],
  p_date TIMESTAMPTZ,
  p_duration INTEGER
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_final_quiz_id UUID;
  v_level_id UUID;
  v_eligible UUID[];
  v_student_id UUID;
  v_scheduled_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Get the current level's final exam quiz
  SELECT g.level_id INTO v_level_id FROM groups g WHERE g.id = p_group_id;
  SELECT l.final_exam_quiz_id INTO v_final_quiz_id FROM levels l WHERE l.id = v_level_id;

  IF v_final_quiz_id IS NULL THEN
    RAISE EXCEPTION 'No final exam configured for this level';
  END IF;

  -- Find eligible students (completed required sessions for their current level)
  SELECT array_agg(sc.student_id) INTO v_eligible
  FROM (
    SELECT gsp.student_id
    FROM group_student_progress gsp
    JOIN levels l ON l.id = gsp.current_level_id
    WHERE gsp.group_id = p_group_id
      AND gsp.student_id = ANY(p_student_ids)
      AND gsp.status IN ('in_progress', 'awaiting_exam')
      AND (
        SELECT COUNT(DISTINCT a.session_id)
        FROM attendance a
        JOIN sessions s ON s.id = a.session_id
        WHERE s.group_id = p_group_id
          AND s.level_id = gsp.current_level_id
          AND a.student_id = gsp.student_id
          AND a.status IN ('present', 'late')
          AND s.status = 'completed'
      ) >= l.expected_sessions_count
  ) sc;

  IF v_eligible IS NULL THEN
    RETURN jsonb_build_object('scheduled', 0, 'skipped', array_length(p_student_ids, 1));
  END IF;

  -- Create quiz assignments (idempotent via unique index)
  FOREACH v_student_id IN ARRAY v_eligible
  LOOP
    INSERT INTO quiz_assignments (quiz_id, student_id, group_id, assigned_by, start_time, due_date)
    VALUES (v_final_quiz_id, v_student_id, p_group_id, auth.uid(), p_date, p_date + (p_duration || ' minutes')::interval)
    ON CONFLICT DO NOTHING;

    IF FOUND THEN
      v_scheduled_count := v_scheduled_count + 1;
      UPDATE group_student_progress
      SET status = 'exam_scheduled', exam_scheduled_at = now(), updated_at = now()
      WHERE group_id = p_group_id AND student_id = v_student_id;
    ELSE
      v_skipped_count := v_skipped_count + 1;
    END IF;
  END LOOP;

  -- Update group level_status
  UPDATE groups SET level_status = 'exam_scheduled' WHERE id = p_group_id;

  RETURN jsonb_build_object(
    'scheduled', v_scheduled_count,
    'skipped', v_skipped_count,
    'total_eligible', COALESCE(array_length(v_eligible, 1), 0)
  );
END;
$$;

-- 6.4 compute_level_grades_batch
CREATE OR REPLACE FUNCTION public.compute_level_grades_batch(p_group_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level_id UUID;
  v_final_quiz_id UUID;
  v_pass_threshold NUMERIC;
  v_count INTEGER;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Get group level info
  SELECT g.level_id INTO v_level_id FROM groups g WHERE g.id = p_group_id;
  SELECT l.final_exam_quiz_id, l.pass_threshold INTO v_final_quiz_id, v_pass_threshold
  FROM levels l WHERE l.id = v_level_id;

  v_pass_threshold := COALESCE(v_pass_threshold, 50);

  -- Set-based UPSERT into level_grades
  WITH eval_avgs AS (
    SELECT se.student_id,
      ROUND(AVG(se.percentage)) as evaluation_avg
    FROM session_evaluations se
    JOIN sessions s ON s.id = se.session_id
    WHERE s.group_id = p_group_id
      AND s.level_id = v_level_id
      AND s.status = 'completed'
    GROUP BY se.student_id
  ),
  exam_scores AS (
    SELECT qs.student_id,
      qs.percentage as final_exam_score
    FROM quiz_submissions qs
    JOIN quiz_assignments qa ON qa.id = qs.quiz_assignment_id
    WHERE qa.quiz_id = v_final_quiz_id
      AND qa.group_id = p_group_id
      AND qs.status = 'submitted'
      AND qs.submitted_at = (
        SELECT MAX(qs2.submitted_at)
        FROM quiz_submissions qs2
        WHERE qs2.quiz_assignment_id = qs.quiz_assignment_id
          AND qs2.student_id = qs.student_id
          AND qs2.status = 'submitted'
      )
  )
  INSERT INTO level_grades (student_id, group_id, level_id, evaluation_avg, final_exam_score, outcome, graded_by)
  SELECT ea.student_id, p_group_id, v_level_id,
    ea.evaluation_avg, es.final_exam_score,
    CASE WHEN ((COALESCE(ea.evaluation_avg,0) + COALESCE(es.final_exam_score,0)) / 2.0) >= v_pass_threshold
      THEN 'passed' ELSE 'failed' END,
    auth.uid()
  FROM eval_avgs ea
  LEFT JOIN exam_scores es ON es.student_id = ea.student_id
  ON CONFLICT (student_id, group_id, level_id)
  DO UPDATE SET
    evaluation_avg = EXCLUDED.evaluation_avg,
    final_exam_score = EXCLUDED.final_exam_score,
    outcome = EXCLUDED.outcome,
    graded_by = EXCLUDED.graded_by,
    updated_at = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Update group_student_progress for graded students
  UPDATE group_student_progress gsp
  SET status = 'graded',
    outcome = lg.outcome,
    graded_at = now(),
    updated_at = now()
  FROM level_grades lg
  WHERE lg.group_id = p_group_id
    AND lg.level_id = v_level_id
    AND lg.student_id = gsp.student_id
    AND gsp.group_id = p_group_id;

  -- Update group status
  UPDATE groups SET level_status = 'grades_computed' WHERE id = p_group_id;

  RETURN jsonb_build_object('graded_count', v_count);
END;
$$;

-- 6.5 upgrade_student_level
CREATE OR REPLACE FUNCTION public.upgrade_student_level(
  p_student_id UUID,
  p_group_id UUID,
  p_chosen_track_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_progress RECORD;
  v_next_level_id UUID;
  v_current_level_order INTEGER;
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
    -- Track branching: find level with matching parent and track
    SELECT id INTO v_next_level_id
    FROM levels
    WHERE parent_level_id = v_progress.current_level_id
      AND track_id = p_chosen_track_id
      AND is_active = true
    LIMIT 1;

    IF v_next_level_id IS NULL THEN
      RAISE EXCEPTION 'No matching level found for this track';
    END IF;

    -- Save track choice
    INSERT INTO student_track_choices (student_id, group_id, from_level_id, chosen_track_id, chosen_by)
    VALUES (p_student_id, p_group_id, v_progress.current_level_id, p_chosen_track_id, auth.uid())
    ON CONFLICT (student_id, group_id, from_level_id) DO NOTHING;
  ELSE
    -- Linear progression: next level_order with same track
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

  -- 1. Log transition FIRST
  INSERT INTO student_level_transitions (student_id, group_id, from_level_id, to_level_id, reason, created_by)
  VALUES (p_student_id, p_group_id, v_progress.current_level_id, v_next_level_id, 'passed', auth.uid());

  -- 2. Update progress
  UPDATE group_student_progress
  SET level_completed_at = now(),
    current_level_id = v_next_level_id,
    current_track_id = COALESCE(p_chosen_track_id, current_track_id),
    status = 'in_progress',
    outcome = NULL,
    level_started_at = now(),
    exam_scheduled_at = NULL,
    exam_submitted_at = NULL,
    graded_at = NULL,
    updated_at = now()
  WHERE group_id = p_group_id AND student_id = p_student_id;

  RETURN jsonb_build_object('upgraded', true, 'next_level_id', v_next_level_id);
END;
$$;

-- 6.6 mark_student_repeat
CREATE OR REPLACE FUNCTION public.mark_student_repeat(p_student_id UUID, p_group_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    level_started_at = now(),
    exam_scheduled_at = NULL,
    exam_submitted_at = NULL,
    graded_at = NULL,
    updated_at = now()
  WHERE group_id = p_group_id AND student_id = p_student_id;

  RETURN jsonb_build_object('repeated', true);
END;
$$;

-- ==================== 7. REALTIME ====================
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_student_progress;
