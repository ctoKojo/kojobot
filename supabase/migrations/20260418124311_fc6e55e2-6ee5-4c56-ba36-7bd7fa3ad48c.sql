
-- ============================================================
-- 1) Tables: per-student overrides
-- ============================================================
CREATE TABLE public.quiz_assignment_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_assignment_id UUID NOT NULL REFERENCES public.quiz_assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  start_time TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  extra_minutes INTEGER NOT NULL DEFAULT 0,
  makeup_session_id UUID REFERENCES public.makeup_sessions(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'makeup_auto' | 'attendance_auto'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(quiz_assignment_id, student_id)
);

CREATE INDEX idx_qao_student ON public.quiz_assignment_overrides(student_id);
CREATE INDEX idx_qao_qa ON public.quiz_assignment_overrides(quiz_assignment_id);
CREATE INDEX idx_qao_makeup ON public.quiz_assignment_overrides(makeup_session_id);

CREATE TABLE public.assignment_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  due_date TIMESTAMPTZ,
  makeup_session_id UUID REFERENCES public.makeup_sessions(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, student_id)
);

CREATE INDEX idx_ao_student ON public.assignment_overrides(student_id);
CREATE INDEX idx_ao_assignment ON public.assignment_overrides(assignment_id);

-- updated_at triggers
CREATE TRIGGER trg_qao_updated_at
  BEFORE UPDATE ON public.quiz_assignment_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_ao_updated_at
  BEFORE UPDATE ON public.assignment_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2) RLS
-- ============================================================
ALTER TABLE public.quiz_assignment_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_overrides ENABLE ROW LEVEL SECURITY;

-- Students see their own
CREATE POLICY "Students see their own quiz overrides"
  ON public.quiz_assignment_overrides FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students see their own assignment overrides"
  ON public.assignment_overrides FOR SELECT
  USING (auth.uid() = student_id);

-- Staff see all
CREATE POLICY "Staff see all quiz overrides"
  ON public.quiz_assignment_overrides FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'reception')
    OR public.has_role(auth.uid(), 'instructor')
  );

CREATE POLICY "Staff see all assignment overrides"
  ON public.assignment_overrides FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'reception')
    OR public.has_role(auth.uid(), 'instructor')
  );

-- Admins/instructors can manage
CREATE POLICY "Admins manage quiz overrides"
  ON public.quiz_assignment_overrides FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));

CREATE POLICY "Admins manage assignment overrides"
  ON public.assignment_overrides FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'instructor'));

-- ============================================================
-- 3) Effective window helpers
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_effective_quiz_window(
  p_student_id UUID,
  p_quiz_assignment_id UUID
)
RETURNS TABLE (
  start_time TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  extra_minutes INTEGER,
  source TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_override RECORD;
  v_default RECORD;
BEGIN
  SELECT o.start_time, o.due_date, o.extra_minutes, o.source
    INTO v_override
  FROM public.quiz_assignment_overrides o
  WHERE o.quiz_assignment_id = p_quiz_assignment_id
    AND o.student_id = p_student_id;

  IF FOUND THEN
    SELECT qa.start_time AS d_start, qa.due_date AS d_due
      INTO v_default
    FROM public.quiz_assignments qa
    WHERE qa.id = p_quiz_assignment_id;

    start_time := COALESCE(v_override.start_time, v_default.d_start);
    due_date := COALESCE(v_override.due_date, v_default.d_due);
    extra_minutes := COALESCE(v_override.extra_minutes, 0);
    source := v_override.source;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT qa.start_time AS d_start, qa.due_date AS d_due
    INTO v_default
  FROM public.quiz_assignments qa
  WHERE qa.id = p_quiz_assignment_id;

  start_time := v_default.d_start;
  due_date := v_default.d_due;
  extra_minutes := 0;
  source := 'default';
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_effective_assignment_due(
  p_student_id UUID,
  p_assignment_id UUID
)
RETURNS TABLE (due_date TIMESTAMPTZ, source TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_override RECORD;
  v_default TIMESTAMPTZ;
BEGIN
  SELECT o.due_date, o.source INTO v_override
  FROM public.assignment_overrides o
  WHERE o.assignment_id = p_assignment_id
    AND o.student_id = p_student_id;

  SELECT a.due_date INTO v_default FROM public.assignments a WHERE a.id = p_assignment_id;

  IF FOUND AND v_override.due_date IS NOT NULL THEN
    due_date := v_override.due_date;
    source := v_override.source;
  ELSE
    due_date := v_default;
    source := 'default';
  END IF;
  RETURN NEXT;
END;
$$;

-- ============================================================
-- 4) Trigger: when a makeup_session is scheduled, generate overrides
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_makeup_quiz_overrides()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_start TIMESTAMPTZ;
  v_duration_min INTEGER;
  v_session_end TIMESTAMPTZ;
  v_qa RECORD;
  v_a RECORD;
BEGIN
  -- Only act on scheduled makeups with date+time set
  IF NEW.status NOT IN ('scheduled', 'confirmed') OR NEW.scheduled_date IS NULL OR NEW.scheduled_time IS NULL THEN
    RETURN NEW;
  END IF;

  -- Compute makeup window in Cairo TZ
  v_session_start := (NEW.scheduled_date::text || ' ' || NEW.scheduled_time::text)::timestamp AT TIME ZONE 'Africa/Cairo';

  -- Get duration from group; fallback 60 min
  SELECT COALESCE(g.duration_minutes, 60) INTO v_duration_min
  FROM public.groups g
  WHERE g.id = NEW.group_id;
  v_duration_min := COALESCE(v_duration_min, 60);

  v_session_end := v_session_start + (v_duration_min || ' minutes')::interval;

  -- For every quiz_assignment tied to original session, upsert per-student override
  FOR v_qa IN
    SELECT id FROM public.quiz_assignments
    WHERE session_id = NEW.original_session_id
      AND is_active = true
      AND COALESCE(is_auto_generated, false) = false
  LOOP
    INSERT INTO public.quiz_assignment_overrides (
      quiz_assignment_id, student_id, start_time, due_date, makeup_session_id, source
    ) VALUES (
      v_qa.id, NEW.student_id, v_session_start, v_session_end, NEW.id, 'makeup_auto'
    )
    ON CONFLICT (quiz_assignment_id, student_id)
    DO UPDATE SET
      start_time = EXCLUDED.start_time,
      due_date = EXCLUDED.due_date,
      makeup_session_id = EXCLUDED.makeup_session_id,
      source = 'makeup_auto',
      updated_at = now()
    WHERE public.assignment_overrides.source IN ('makeup_auto', 'manual') OR true;
  END LOOP;

  -- For every assignment tied to original session, upsert per-student override
  -- (assignment due = makeup time + 7 days, so student has time to submit)
  FOR v_a IN
    SELECT id FROM public.assignments
    WHERE session_id = NEW.original_session_id
      AND COALESCE(is_active, true) = true
      AND COALESCE(is_auto_generated, false) = false
  LOOP
    INSERT INTO public.assignment_overrides (
      assignment_id, student_id, due_date, makeup_session_id, source
    ) VALUES (
      v_a.id, NEW.student_id, v_session_end + interval '7 days', NEW.id, 'makeup_auto'
    )
    ON CONFLICT (assignment_id, student_id)
    DO UPDATE SET
      due_date = EXCLUDED.due_date,
      makeup_session_id = EXCLUDED.makeup_session_id,
      source = 'makeup_auto',
      updated_at = now();
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_makeup_quiz_overrides ON public.makeup_sessions;
CREATE TRIGGER trg_makeup_quiz_overrides
  AFTER INSERT OR UPDATE OF status, scheduled_date, scheduled_time, assigned_instructor_id
  ON public.makeup_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_makeup_quiz_overrides();

-- ============================================================
-- 5) Trigger: when attendance is marked PRESENT on original session,
--    generate overrides scoped to original session window.
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_attendance_quiz_overrides()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_session_start TIMESTAMPTZ;
  v_session_end TIMESTAMPTZ;
  v_duration_min INTEGER;
  v_qa RECORD;
  v_a RECORD;
BEGIN
  IF NEW.status NOT IN ('present', 'late') THEN
    RETURN NEW;
  END IF;

  -- Skip if this attendance row was created via makeup (compensation_status set)
  IF NEW.makeup_session_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.session_date, s.session_time, s.group_id, COALESCE(g.duration_minutes, 60) AS dur
    INTO v_session
  FROM public.sessions s
  LEFT JOIN public.groups g ON g.id = s.group_id
  WHERE s.id = NEW.session_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  v_session_start := (v_session.session_date::text || ' ' || v_session.session_time::text)::timestamp AT TIME ZONE 'Africa/Cairo';
  v_duration_min := COALESCE(v_session.dur, 60);
  v_session_end := v_session_start + (v_duration_min || ' minutes')::interval;

  FOR v_qa IN
    SELECT id FROM public.quiz_assignments
    WHERE session_id = NEW.session_id
      AND is_active = true
      AND COALESCE(is_auto_generated, false) = false
  LOOP
    INSERT INTO public.quiz_assignment_overrides (
      quiz_assignment_id, student_id, start_time, due_date, source
    ) VALUES (
      v_qa.id, NEW.student_id, v_session_start, v_session_end, 'attendance_auto'
    )
    ON CONFLICT (quiz_assignment_id, student_id)
    DO UPDATE SET
      start_time = EXCLUDED.start_time,
      due_date = EXCLUDED.due_date,
      source = 'attendance_auto',
      updated_at = now()
    WHERE public.quiz_assignment_overrides.source <> 'manual';
  END LOOP;

  FOR v_a IN
    SELECT id FROM public.assignments
    WHERE session_id = NEW.session_id
      AND COALESCE(is_active, true) = true
      AND COALESCE(is_auto_generated, false) = false
  LOOP
    INSERT INTO public.assignment_overrides (
      assignment_id, student_id, due_date, source
    ) VALUES (
      v_a.id, NEW.student_id, v_session_end + interval '7 days', 'attendance_auto'
    )
    ON CONFLICT (assignment_id, student_id)
    DO UPDATE SET
      due_date = EXCLUDED.due_date,
      source = 'attendance_auto',
      updated_at = now()
    WHERE public.assignment_overrides.source <> 'manual';
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_quiz_overrides ON public.attendance;
CREATE TRIGGER trg_attendance_quiz_overrides
  AFTER INSERT OR UPDATE OF status
  ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_attendance_quiz_overrides();
