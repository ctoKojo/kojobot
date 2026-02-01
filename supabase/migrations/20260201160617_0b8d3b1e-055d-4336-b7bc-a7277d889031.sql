-- Add start_time column to quiz_assignments table
-- This will store when the quiz becomes available for students to take

ALTER TABLE public.quiz_assignments 
ADD COLUMN start_time timestamp with time zone;