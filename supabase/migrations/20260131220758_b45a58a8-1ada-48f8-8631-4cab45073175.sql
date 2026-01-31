-- Create instructor_schedules table for storing weekly work schedule
CREATE TABLE public.instructor_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    instructor_id uuid NOT NULL,
    day_of_week text NOT NULL CHECK (day_of_week IN ('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')),
    is_working_day boolean NOT NULL DEFAULT true,
    start_time time,
    end_time time,
    notes text,
    notes_ar text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (instructor_id, day_of_week)
);

-- Enable RLS
ALTER TABLE public.instructor_schedules ENABLE ROW LEVEL SECURITY;

-- Admin can manage all schedules
CREATE POLICY "Admins can manage instructor schedules"
ON public.instructor_schedules
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Instructors can view their own schedule
CREATE POLICY "Instructors can view their own schedule"
ON public.instructor_schedules
FOR SELECT
USING (has_role(auth.uid(), 'instructor'::app_role) AND instructor_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_instructor_schedules_updated_at
BEFORE UPDATE ON public.instructor_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();