-- Drop the old restrictive check constraint
ALTER TABLE public.instructor_warnings DROP CONSTRAINT instructor_warnings_warning_type_check;

-- Add new check constraint with both automated and manual warning types
ALTER TABLE public.instructor_warnings ADD CONSTRAINT instructor_warnings_warning_type_check 
CHECK (warning_type = ANY (ARRAY[
  'no_quiz'::text, 'no_assignment'::text, 'no_attendance'::text,
  'behavior'::text, 'non_compliance'::text, 'poor_performance'::text,
  'attendance'::text, 'late_submission'::text, 'other'::text
]));