
ALTER TABLE public.group_student_progress 
  DROP CONSTRAINT group_student_progress_status_check;

ALTER TABLE public.group_student_progress 
  ADD CONSTRAINT group_student_progress_status_check 
  CHECK (status = ANY (ARRAY['in_progress','awaiting_exam','exam_scheduled','graded','paused','pending_group_assignment']));
