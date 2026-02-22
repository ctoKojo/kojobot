
-- 1. Create the online_attendance_logs table
CREATE TABLE public.online_attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  first_joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  heartbeat_count integer NOT NULL DEFAULT 0,
  attendance_status_initial text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT online_attendance_logs_session_student_unique UNIQUE (session_id, student_id),
  CONSTRAINT online_attendance_logs_status_check CHECK (status IN ('active', 'completed', 'dropped')),
  CONSTRAINT online_attendance_logs_initial_status_check CHECK (attendance_status_initial IN ('present', 'late', 'absent'))
);

-- 2. Index for fast lookups
CREATE INDEX idx_online_attendance_logs_session ON public.online_attendance_logs(session_id);
CREATE INDEX idx_online_attendance_logs_group ON public.online_attendance_logs(group_id);
CREATE INDEX idx_online_attendance_logs_student ON public.online_attendance_logs(student_id);
CREATE INDEX idx_online_attendance_logs_status ON public.online_attendance_logs(status);

-- 3. Enable RLS
ALTER TABLE public.online_attendance_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Students can insert their own records only
CREATE POLICY "Students can insert own attendance log"
ON public.online_attendance_logs
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'student'::app_role)
  AND student_id = auth.uid()
);

-- Students can update only last_seen_at and heartbeat_count on their own records
CREATE POLICY "Students can update own heartbeat"
ON public.online_attendance_logs
FOR UPDATE
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND student_id = auth.uid()
);

-- Students can view their own records
CREATE POLICY "Students can view own attendance log"
ON public.online_attendance_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND student_id = auth.uid()
);

-- Admins can do everything
CREATE POLICY "Admins can manage attendance logs"
ON public.online_attendance_logs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Instructors can view attendance logs for their groups
CREATE POLICY "Instructors can view attendance logs"
ON public.online_attendance_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'instructor'::app_role)
  AND group_id IN (SELECT get_instructor_group_ids(auth.uid()))
);

-- 5. Trigger: protect sensitive fields from client-side modification
CREATE OR REPLACE FUNCTION public.protect_online_attendance_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prevent changing first_joined_at
  IF OLD.first_joined_at IS DISTINCT FROM NEW.first_joined_at THEN
    RAISE EXCEPTION 'Cannot modify first_joined_at after creation';
  END IF;

  -- Prevent changing attendance_status_initial
  IF OLD.attendance_status_initial IS DISTINCT FROM NEW.attendance_status_initial THEN
    RAISE EXCEPTION 'Cannot modify attendance_status_initial after creation';
  END IF;

  -- Prevent non-service_role from changing status
  -- Service role bypass: when called from edge functions with service_role key,
  -- current_setting('request.jwt.claim.role') = 'service_role'
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'Only server can modify status field';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_online_attendance_fields_trigger
BEFORE UPDATE ON public.online_attendance_logs
FOR EACH ROW
EXECUTE FUNCTION public.protect_online_attendance_fields();
