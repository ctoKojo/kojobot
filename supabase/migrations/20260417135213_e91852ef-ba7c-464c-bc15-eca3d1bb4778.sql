-- Expand attachment_type check constraints to accept common MIME types
-- in addition to the short forms (text, image, pdf, video)

ALTER TABLE public.assignments
  DROP CONSTRAINT IF EXISTS assignments_attachment_type_check;

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_attachment_type_check
  CHECK (
    attachment_type IS NULL
    OR attachment_type IN ('text', 'image', 'pdf', 'video')
    OR attachment_type ~ '^(image|video|audio|application|text)/[A-Za-z0-9.+-]+$'
  );

ALTER TABLE public.assignment_submissions
  DROP CONSTRAINT IF EXISTS assignment_submissions_attachment_type_check;

ALTER TABLE public.assignment_submissions
  ADD CONSTRAINT assignment_submissions_attachment_type_check
  CHECK (
    attachment_type IS NULL
    OR attachment_type IN ('text', 'image', 'pdf', 'video')
    OR attachment_type ~ '^(image|video|audio|application|text)/[A-Za-z0-9.+-]+$'
  );