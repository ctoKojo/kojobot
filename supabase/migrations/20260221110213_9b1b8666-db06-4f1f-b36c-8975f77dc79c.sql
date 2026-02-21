
-- ============ Step 1: Add columns + constraints to sessions ============

ALTER TABLE public.sessions ADD COLUMN is_makeup boolean NOT NULL DEFAULT false;
ALTER TABLE public.sessions ADD COLUMN makeup_session_id uuid REFERENCES public.makeup_sessions(id);

-- UNIQUE: each makeup_session links to exactly one session
ALTER TABLE public.sessions ADD CONSTRAINT sessions_makeup_session_id_unique 
  UNIQUE (makeup_session_id);

-- CHECK: is_makeup consistency with makeup_session_id
ALTER TABLE public.sessions ADD CONSTRAINT sessions_makeup_consistency_check
  CHECK (
    (is_makeup = false AND makeup_session_id IS NULL)
    OR (is_makeup = true AND makeup_session_id IS NOT NULL)
  );

-- Partial index for performance
CREATE INDEX idx_sessions_makeup_session_id 
  ON public.sessions(makeup_session_id) WHERE makeup_session_id IS NOT NULL;

-- ============ Step 2: RPC schedule_makeup_session ============

CREATE OR REPLACE FUNCTION public.schedule_makeup_session(
  p_makeup_id uuid,
  p_date date,
  p_time time,
  p_instructor_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_makeup RECORD;
  v_group RECORD;
  v_session_number INTEGER;
  v_existing_session_id UUID;
  v_new_session_id UUID;
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();

  -- Lock makeup session row
  SELECT ms.* INTO v_makeup
  FROM makeup_sessions ms
  WHERE ms.id = p_makeup_id
  FOR UPDATE;

  IF v_makeup IS NULL THEN
    RAISE EXCEPTION 'Makeup session not found';
  END IF;

  -- Authorization
  IF NOT EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = v_makeup.group_id
    AND (
      g.instructor_id = v_caller_id
      OR has_role(v_caller_id, 'admin'::app_role)
      OR has_role(v_caller_id, 'reception'::app_role)
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Validate status
  IF v_makeup.status NOT IN ('pending', 'scheduled') THEN
    RAISE EXCEPTION 'Cannot schedule a makeup session with status: %', v_makeup.status;
  END IF;

  -- Get group data
  SELECT g.duration_minutes, g.schedule_time INTO v_group
  FROM groups g WHERE g.id = v_makeup.group_id;

  -- Get session_number from original session
  SELECT s.session_number INTO v_session_number
  FROM sessions s WHERE s.id = v_makeup.original_session_id;

  -- Check if already has a linked session (reschedule case)
  SELECT s.id INTO v_existing_session_id
  FROM sessions s WHERE s.makeup_session_id = p_makeup_id;

  IF v_existing_session_id IS NOT NULL THEN
    -- Reschedule: update existing session
    UPDATE sessions SET
      session_date = p_date,
      session_time = p_time,
      updated_at = now()
    WHERE id = v_existing_session_id;

    -- Update makeup record
    UPDATE makeup_sessions SET
      scheduled_date = p_date,
      scheduled_time = p_time,
      assigned_instructor_id = COALESCE(p_instructor_id, assigned_instructor_id),
      notes = COALESCE(p_notes, notes),
      student_confirmed = NULL
    WHERE id = p_makeup_id;

    RETURN jsonb_build_object(
      'session_id', v_existing_session_id,
      'makeup_id', p_makeup_id,
      'scheduled_date', p_date,
      'scheduled_time', p_time,
      'rescheduled', true
    );
  END IF;

  -- New schedule: update makeup_sessions
  UPDATE makeup_sessions SET
    scheduled_date = p_date,
    scheduled_time = p_time,
    status = 'scheduled',
    assigned_instructor_id = COALESCE(p_instructor_id, assigned_instructor_id),
    notes = COALESCE(p_notes, notes),
    student_confirmed = NULL
  WHERE id = p_makeup_id;

  -- Create real session
  INSERT INTO sessions (
    group_id, session_date, session_time, duration_minutes,
    status, session_number, is_makeup, makeup_session_id
  ) VALUES (
    v_makeup.group_id, p_date, p_time, v_group.duration_minutes,
    'scheduled', v_session_number, true, p_makeup_id
  )
  RETURNING id INTO v_new_session_id;

  RETURN jsonb_build_object(
    'session_id', v_new_session_id,
    'makeup_id', p_makeup_id,
    'scheduled_date', p_date,
    'scheduled_time', p_time,
    'rescheduled', false
  );
END;
$function$;

-- ============ Step 3: RPC complete_makeup_session ============

CREATE OR REPLACE FUNCTION public.complete_makeup_session(
  p_session_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_session RECORD;
  v_makeup RECORD;
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();

  -- Lock session + validate
  SELECT s.* INTO v_session
  FROM sessions s
  WHERE s.id = p_session_id
  FOR UPDATE;

  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF NOT v_session.is_makeup THEN
    RAISE EXCEPTION 'Session is not a makeup session';
  END IF;

  IF v_session.status = 'completed' THEN
    RETURN jsonb_build_object('completed', false, 'reason', 'already_completed');
  END IF;

  -- Authorization
  IF NOT EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = v_session.group_id
    AND (
      g.instructor_id = v_caller_id
      OR has_role(v_caller_id, 'admin'::app_role)
      OR has_role(v_caller_id, 'reception'::app_role)
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get makeup record
  SELECT ms.* INTO v_makeup
  FROM makeup_sessions ms
  WHERE ms.id = v_session.makeup_session_id
  FOR UPDATE;

  IF v_makeup IS NULL THEN
    RAISE EXCEPTION 'Linked makeup session not found';
  END IF;

  -- 1. Complete the session
  UPDATE sessions SET status = 'completed', updated_at = now()
  WHERE id = p_session_id;

  -- 2. Complete the makeup record
  UPDATE makeup_sessions SET status = 'completed', completed_at = now()
  WHERE id = v_session.makeup_session_id;

  -- 3. Mark original attendance as compensated
  UPDATE attendance SET compensation_status = 'compensated'
  WHERE session_id = v_makeup.original_session_id
    AND student_id = v_makeup.student_id
    AND compensation_status = 'pending_compensation';

  RETURN jsonb_build_object(
    'completed', true,
    'student_id', v_makeup.student_id,
    'original_session_id', v_makeup.original_session_id
  );
END;
$function$;

-- ============ Step 4: Update save_attendance - restrict makeup attendance ============

CREATE OR REPLACE FUNCTION public.save_attendance(p_session_id uuid, p_group_id uuid, p_records jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id UUID;
  v_session_id UUID;
  v_session_status TEXT;
  v_session_date DATE;
  v_session_time TIME;
  v_duration_minutes INTEGER;
  v_group_instructor_id UUID;
  v_rec JSONB;
  v_student_id UUID;
  v_status TEXT;
  v_notes TEXT;
  v_makeup_result JSONB;
  v_makeup_id UUID;
  v_old_makeup_id UUID;
  v_total INTEGER := 0;
  v_created_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
  v_cancelled_count INTEGER := 0;
  v_instructor_confirmed BOOLEAN := false;
  v_session_completed BOOLEAN := false;
  v_student_count INTEGER;
  v_attendance_count INTEGER;
  v_staff_confirmed BOOLEAN;
  -- NEW: makeup session variables
  v_is_makeup BOOLEAN;
  v_makeup_session_id UUID;
  v_makeup_student_id UUID;
BEGIN
  v_caller_id := auth.uid();

  -- ============ Authorization ============
  IF NOT EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = p_group_id
    AND (
      g.instructor_id = v_caller_id
      OR has_role(v_caller_id, 'admin'::app_role)
      OR has_role(v_caller_id, 'reception'::app_role)
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized: you cannot manage attendance for this group';
  END IF;

  -- ============ Lock + Validate session ============
  SELECT s.id, s.status, s.session_date, s.session_time, s.duration_minutes, s.is_makeup, s.makeup_session_id
  INTO v_session_id, v_session_status, v_session_date, v_session_time, v_duration_minutes, v_is_makeup, v_makeup_session_id
  FROM sessions s
  WHERE s.id = p_session_id AND s.group_id = p_group_id
  FOR UPDATE;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'Invalid session or group mismatch';
  END IF;

  -- ============ NEW: Restrict makeup attendance to assigned student ============
  IF v_is_makeup AND v_makeup_session_id IS NOT NULL THEN
    SELECT ms.student_id INTO v_makeup_student_id
    FROM makeup_sessions ms WHERE ms.id = v_makeup_session_id;

    IF v_makeup_student_id IS NOT NULL THEN
      FOR v_rec IN SELECT * FROM jsonb_array_elements(p_records)
      LOOP
        IF (v_rec->>'student_id')::UUID != v_makeup_student_id THEN
          RAISE EXCEPTION 'Makeup session attendance can only be recorded for the assigned student';
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Get group instructor
  SELECT instructor_id INTO v_group_instructor_id
  FROM groups WHERE id = p_group_id;

  -- ============ Process each record ============
  FOR v_rec IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    v_student_id := (v_rec->>'student_id')::UUID;
    v_status := v_rec->>'status';
    v_notes := v_rec->>'notes';

    IF v_status = 'absent' THEN
      -- === ABSENT: get_or_create makeup + link ===
      v_makeup_result := create_makeup_session(
        v_student_id,
        p_session_id,
        p_group_id,
        'student_absent',
        'individual'
      );

      v_makeup_id := (v_makeup_result->>'id')::UUID;

      IF v_makeup_id IS NULL THEN
        RAISE EXCEPTION 'Failed to create/get makeup session for student %', v_student_id;
      END IF;

      IF (v_makeup_result->>'created')::boolean THEN
        v_created_count := v_created_count + 1;
      ELSE
        v_skipped_count := v_skipped_count + 1;
      END IF;

      -- Upsert attendance with makeup link
      INSERT INTO attendance (session_id, student_id, status, notes, recorded_by, compensation_status, makeup_session_id)
      VALUES (p_session_id, v_student_id, 'absent', v_notes, v_caller_id, 'pending_compensation', v_makeup_id)
      ON CONFLICT (session_id, student_id) DO UPDATE SET
        status = 'absent',
        notes = EXCLUDED.notes,
        recorded_by = EXCLUDED.recorded_by,
        compensation_status = 'pending_compensation',
        makeup_session_id = EXCLUDED.makeup_session_id,
        recorded_at = now();

    ELSE
      -- === NOT ABSENT: cancel pending makeup if exists ===

      -- Check for existing linked makeup
      SELECT makeup_session_id INTO v_old_makeup_id
      FROM attendance
      WHERE session_id = p_session_id AND student_id = v_student_id;

      IF v_old_makeup_id IS NOT NULL THEN
        -- Cancel the makeup if still pending
        UPDATE makeup_sessions
        SET status = 'cancelled'
        WHERE id = v_old_makeup_id AND status = 'pending';

        IF FOUND THEN
          v_cancelled_count := v_cancelled_count + 1;
        END IF;
      END IF;

      -- Upsert attendance without makeup link
      INSERT INTO attendance (session_id, student_id, status, notes, recorded_by, compensation_status, makeup_session_id)
      VALUES (p_session_id, v_student_id, v_status, v_notes, v_caller_id, 'none', NULL)
      ON CONFLICT (session_id, student_id) DO UPDATE SET
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        recorded_by = EXCLUDED.recorded_by,
        compensation_status = 'none',
        makeup_session_id = NULL,
        recorded_at = now();
    END IF;

    v_total := v_total + 1;
  END LOOP;

  -- ============ Auto-confirm instructor attendance ============
  IF v_caller_id = v_group_instructor_id AND v_session_status != 'cancelled' THEN
    IF NOT EXISTS (
      SELECT 1 FROM session_staff_attendance
      WHERE session_id = p_session_id AND staff_id = v_caller_id
    ) THEN
      INSERT INTO session_staff_attendance (session_id, staff_id, status, actual_hours)
      VALUES (p_session_id, v_caller_id, 'confirmed', v_duration_minutes::numeric / 60.0);
      v_instructor_confirmed := true;
    END IF;
  END IF;

  -- ============ Auto-complete session ============
  IF v_session_status = 'scheduled' THEN
    SELECT COUNT(*) INTO v_student_count
    FROM group_students WHERE group_id = p_group_id AND is_active = true;

    SELECT COUNT(*) INTO v_attendance_count
    FROM attendance WHERE session_id = p_session_id;

    SELECT EXISTS (
      SELECT 1 FROM session_staff_attendance
      WHERE session_id = p_session_id AND staff_id = v_group_instructor_id AND status = 'confirmed'
    ) INTO v_staff_confirmed;

    IF v_attendance_count >= v_student_count
       AND v_staff_confirmed
       AND (v_session_date + v_session_time + (v_duration_minutes || ' minutes')::interval) <= now()
    THEN
      UPDATE sessions SET status = 'completed' WHERE id = p_session_id;
      v_session_completed := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'saved', v_total,
    'makeups_created', v_created_count,
    'makeups_skipped', v_skipped_count,
    'makeups_cancelled', v_cancelled_count,
    'instructor_confirmed', v_instructor_confirmed,
    'session_completed', v_session_completed
  );
END;
$function$;
