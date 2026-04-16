
-- Drop old check constraint and add new one with expanded values
ALTER TABLE level_grades DROP CONSTRAINT IF EXISTS level_grades_outcome_check;
ALTER TABLE level_grades ADD CONSTRAINT level_grades_outcome_check 
  CHECK (outcome IS NULL OR outcome IN ('passed', 'failed', 'failed_exam', 'failed_total', 'repeat'));
