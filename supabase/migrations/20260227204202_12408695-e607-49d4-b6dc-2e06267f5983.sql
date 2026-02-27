
-- Step 1: Add PDF columns to curriculum_sessions
ALTER TABLE curriculum_sessions ADD COLUMN IF NOT EXISTS student_pdf_path TEXT;
ALTER TABLE curriculum_sessions ADD COLUMN IF NOT EXISTS student_pdf_text TEXT;
ALTER TABLE curriculum_sessions ADD COLUMN IF NOT EXISTS student_pdf_text_updated_at TIMESTAMPTZ;
ALTER TABLE curriculum_sessions ADD COLUMN IF NOT EXISTS student_pdf_filename TEXT;
ALTER TABLE curriculum_sessions ADD COLUMN IF NOT EXISTS student_pdf_size INTEGER;
