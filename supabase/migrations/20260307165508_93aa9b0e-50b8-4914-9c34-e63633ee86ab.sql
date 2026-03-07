
-- Placement Exam Scheduling table
CREATE TABLE public.placement_exam_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_by UUID NOT NULL REFERENCES auth.users(id),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'open', 'expired', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, status) -- only one active schedule per student per status
);

-- Remove the unique constraint since we want multiple schedules but only one active
ALTER TABLE public.placement_exam_schedules DROP CONSTRAINT placement_exam_schedules_student_id_status_key;

-- Add a partial unique index: only one non-cancelled/non-expired/non-completed schedule
CREATE UNIQUE INDEX idx_one_active_schedule ON public.placement_exam_schedules (student_id) 
  WHERE status IN ('scheduled', 'open');

-- RLS
ALTER TABLE public.placement_exam_schedules ENABLE ROW LEVEL SECURITY;

-- Admin/reception can manage all schedules
CREATE POLICY "Admin manages schedules" ON public.placement_exam_schedules
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'reception'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'reception'::app_role)
  );

-- Students can read their own schedule
CREATE POLICY "Student reads own schedule" ON public.placement_exam_schedules
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());
