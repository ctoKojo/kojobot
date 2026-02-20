
-- 1. Unique Constraint to prevent duplicate makeup sessions
ALTER TABLE public.makeup_sessions
ADD CONSTRAINT unique_student_session_makeup
UNIQUE (student_id, original_session_id, makeup_type);

-- 2. Index for group-based reporting
CREATE INDEX IF NOT EXISTS idx_makeup_sessions_group
ON public.makeup_sessions (group_id);

-- 3. Index for curriculum lookup
CREATE INDEX IF NOT EXISTS idx_curriculum_lookup
ON public.curriculum_sessions (age_group_id, level_id, session_number, is_active);

-- 4. RLS Policies for instructors on student_makeup_credits
CREATE POLICY "Instructors can view credits for their students"
ON public.student_makeup_credits FOR SELECT
USING (
  has_role(auth.uid(), 'instructor'::app_role)
  AND student_id IN (
    SELECT gs.student_id FROM group_students gs
    JOIN groups g ON gs.group_id = g.id
    WHERE g.instructor_id = auth.uid() AND gs.is_active = true
  )
);

CREATE POLICY "Instructors can insert credits for their students"
ON public.student_makeup_credits FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'instructor'::app_role)
  AND student_id IN (
    SELECT gs.student_id FROM group_students gs
    JOIN groups g ON gs.group_id = g.id
    WHERE g.instructor_id = auth.uid() AND gs.is_active = true
  )
);

CREATE POLICY "Instructors can update credits for their students"
ON public.student_makeup_credits FOR UPDATE
USING (
  has_role(auth.uid(), 'instructor'::app_role)
  AND student_id IN (
    SELECT gs.student_id FROM group_students gs
    JOIN groups g ON gs.group_id = g.id
    WHERE g.instructor_id = auth.uid() AND gs.is_active = true
  )
);

-- 5. Database Function: create_makeup_session (individual)
CREATE OR REPLACE FUNCTION public.create_makeup_session(
  p_student_id UUID,
  p_original_session_id UUID,
  p_group_id UUID,
  p_reason TEXT,
  p_makeup_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_level_id UUID;
  v_age_group_id UUID;
  v_session_number INTEGER;
  v_curriculum_session_id UUID;
  v_is_free BOOLEAN;
  v_credits RECORD;
  v_new_id UUID;
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();

  -- Authorization check
  IF NOT EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = p_group_id
    AND (
      g.instructor_id = v_caller_id
      OR has_role(v_caller_id, 'admin'::app_role)
      OR has_role(v_caller_id, 'reception'::app_role)
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Validate student belongs to group
  IF NOT EXISTS (
    SELECT 1 FROM group_students gs
    WHERE gs.student_id = p_student_id
    AND gs.group_id = p_group_id
    AND gs.is_active = true
  ) THEN
    RAISE EXCEPTION 'Student does not belong to this group';
  END IF;

  -- Validate session belongs to group
  IF NOT EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.id = p_original_session_id
    AND s.group_id = p_group_id
  ) THEN
    RAISE EXCEPTION 'Session does not belong to this group';
  END IF;

  -- Get group and session data
  SELECT g.level_id, g.age_group_id INTO v_level_id, v_age_group_id
  FROM groups g WHERE g.id = p_group_id;

  SELECT s.session_number INTO v_session_number
  FROM sessions s WHERE s.id = p_original_session_id;

  -- Get curriculum_session_id
  IF v_age_group_id IS NOT NULL AND v_level_id IS NOT NULL AND v_session_number IS NOT NULL THEN
    SELECT cs.id INTO v_curriculum_session_id
    FROM curriculum_sessions cs
    WHERE cs.age_group_id = v_age_group_id
      AND cs.level_id = v_level_id
      AND cs.session_number = v_session_number
      AND cs.is_active = true
    ORDER BY cs.version DESC
    LIMIT 1;
  END IF;

  IF v_curriculum_session_id IS NULL THEN
    RAISE WARNING 'No curriculum_session found for group=%, session_number=%', p_group_id, v_session_number;
  END IF;

  -- Determine free quota
  IF p_reason = 'group_cancelled' THEN
    v_is_free := true;
  ELSIF v_level_id IS NOT NULL THEN
    -- Atomic: upsert then check
    INSERT INTO student_makeup_credits (student_id, level_id, total_free_allowed, used_free)
    VALUES (p_student_id, v_level_id, 2, 0)
    ON CONFLICT (student_id, level_id)
    DO UPDATE SET updated_at = now()
    RETURNING * INTO v_credits;

    IF v_credits.used_free < v_credits.total_free_allowed THEN
      UPDATE student_makeup_credits
      SET used_free = used_free + 1, updated_at = now()
      WHERE student_id = p_student_id AND level_id = v_level_id;
      v_is_free := true;
    ELSE
      v_is_free := false;
    END IF;
  ELSE
    v_is_free := true;
  END IF;

  -- Insert makeup session (rely on unique constraint for duplicate prevention)
  INSERT INTO makeup_sessions (
    student_id, original_session_id, group_id, level_id,
    reason, is_free, makeup_type, curriculum_session_id
  ) VALUES (
    p_student_id, p_original_session_id, p_group_id, v_level_id,
    p_reason, v_is_free, p_makeup_type, v_curriculum_session_id
  )
  RETURNING id INTO v_new_id;

  -- For group_cancelled: ensure credit record exists (audit trail)
  IF p_reason = 'group_cancelled' AND v_level_id IS NOT NULL THEN
    INSERT INTO student_makeup_credits (student_id, level_id, total_free_allowed, used_free)
    VALUES (p_student_id, v_level_id, 2, 0)
    ON CONFLICT (student_id, level_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'created', true,
    'id', v_new_id,
    'is_free', v_is_free,
    'curriculum_session_id', v_curriculum_session_id
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('created', false, 'reason', 'already_exists');
END;
$$;

-- 6. Database Function: create_group_makeup_sessions (bulk)
CREATE OR REPLACE FUNCTION public.create_group_makeup_sessions(
  p_student_ids UUID[],
  p_original_session_id UUID,
  p_group_id UUID,
  p_reason TEXT,
  p_makeup_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_student_id UUID;
  v_result JSONB;
  v_created_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();

  -- Authorization
  IF NOT EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = p_group_id
    AND (
      g.instructor_id = v_caller_id
      OR has_role(v_caller_id, 'admin'::app_role)
      OR has_role(v_caller_id, 'reception'::app_role)
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Session-group validation
  IF NOT EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.id = p_original_session_id
    AND s.group_id = p_group_id
  ) THEN
    RAISE EXCEPTION 'Session does not belong to this group';
  END IF;

  -- Loop internally (single transaction)
  FOREACH v_student_id IN ARRAY p_student_ids
  LOOP
    v_result := create_makeup_session(
      v_student_id,
      p_original_session_id,
      p_group_id,
      p_reason,
      p_makeup_type
    );
    IF (v_result->>'created')::boolean THEN
      v_created_count := v_created_count + 1;
    ELSE
      v_skipped_count := v_skipped_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'created_count', v_created_count,
    'skipped_count', v_skipped_count,
    'total', array_length(p_student_ids, 1)
  );
END;
$$;
