-- Make instructor_id nullable so groups can be created without an instructor
ALTER TABLE public.groups ALTER COLUMN instructor_id DROP NOT NULL;