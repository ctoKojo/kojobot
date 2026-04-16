
ALTER TABLE group_student_progress DROP CONSTRAINT IF EXISTS group_student_progress_outcome_check;
ALTER TABLE group_student_progress ADD CONSTRAINT group_student_progress_outcome_check 
  CHECK (outcome IS NULL OR outcome IN ('passed', 'failed', 'failed_exam', 'failed_total', 'repeat'));
