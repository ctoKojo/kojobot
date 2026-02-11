
-- Create makeup_sessions table
CREATE TABLE public.makeup_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL,
  original_session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  level_id uuid REFERENCES public.levels(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (reason IN ('group_cancelled', 'student_absent')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'completed', 'expired')),
  scheduled_date date,
  scheduled_time time,
  notes text,
  is_free boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Enable RLS
ALTER TABLE public.makeup_sessions ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can manage makeup sessions"
ON public.makeup_sessions
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Instructors can view their groups' makeup sessions
CREATE POLICY "Instructors can view their group makeup sessions"
ON public.makeup_sessions
FOR SELECT
USING (
  public.has_role(auth.uid(), 'instructor') 
  AND group_id IN (SELECT public.get_instructor_group_ids(auth.uid()))
);

-- Instructors can insert makeup sessions for their groups
CREATE POLICY "Instructors can insert makeup sessions for their groups"
ON public.makeup_sessions
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'instructor') 
  AND group_id IN (SELECT public.get_instructor_group_ids(auth.uid()))
);

-- Students can view their own makeup sessions
CREATE POLICY "Students can view their makeup sessions"
ON public.makeup_sessions
FOR SELECT
USING (
  public.has_role(auth.uid(), 'student') 
  AND student_id = auth.uid()
);
