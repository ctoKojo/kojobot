
-- Create session_staff_attendance table
CREATE TABLE public.session_staff_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  actual_hours numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_staff_attendance_status_check CHECK (status IN ('confirmed', 'absent', 'inferred')),
  CONSTRAINT session_staff_attendance_unique UNIQUE (session_id, staff_id)
);

-- Index for monthly salary queries
CREATE INDEX idx_staff_attendance_staff_created ON public.session_staff_attendance (staff_id, created_at);

-- Enable RLS
ALTER TABLE public.session_staff_attendance ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "Admins can manage staff attendance"
  ON public.session_staff_attendance
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Instructor: SELECT + UPDATE on their own sessions
CREATE POLICY "Instructors can view their session attendance"
  ON public.session_staff_attendance
  FOR SELECT
  USING (
    has_role(auth.uid(), 'instructor'::app_role)
    AND session_id IN (
      SELECT s.id FROM public.sessions s
      WHERE s.group_id IN (SELECT get_instructor_group_ids(auth.uid()))
    )
  );

CREATE POLICY "Instructors can update their session attendance"
  ON public.session_staff_attendance
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'instructor'::app_role)
    AND staff_id = auth.uid()
    AND session_id IN (
      SELECT s.id FROM public.sessions s
      WHERE s.group_id IN (SELECT get_instructor_group_ids(auth.uid()))
    )
  );

-- Reception: SELECT + INSERT + UPDATE
CREATE POLICY "Reception can view staff attendance"
  ON public.session_staff_attendance
  FOR SELECT
  USING (has_role(auth.uid(), 'reception'::app_role));

CREATE POLICY "Reception can insert staff attendance"
  ON public.session_staff_attendance
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'reception'::app_role));

CREATE POLICY "Reception can update staff attendance"
  ON public.session_staff_attendance
  FOR UPDATE
  USING (has_role(auth.uid(), 'reception'::app_role));

-- Populate historical data: mark completed sessions as 'inferred'
INSERT INTO public.session_staff_attendance (session_id, staff_id, status, actual_hours)
SELECT 
  s.id,
  g.instructor_id,
  'inferred',
  s.duration_minutes / 60.0
FROM public.sessions s
JOIN public.groups g ON s.group_id = g.id
WHERE s.status = 'completed'
  AND g.instructor_id IS NOT NULL
ON CONFLICT (session_id, staff_id) DO NOTHING;
