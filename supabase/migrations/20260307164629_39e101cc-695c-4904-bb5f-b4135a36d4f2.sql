-- Fix: status CHECK constraint must include 'submitted' for grade-placement-exam
ALTER TABLE placement_exam_attempts DROP CONSTRAINT placement_exam_attempts_status_check;
ALTER TABLE placement_exam_attempts ADD CONSTRAINT placement_exam_attempts_status_check 
  CHECK (status IN ('in_progress', 'submitted', 'completed', 'expired', 'cancelled'));