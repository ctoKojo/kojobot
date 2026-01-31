-- Add attendance_mode column to profiles table (for students)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS attendance_mode text DEFAULT 'offline';

-- Add attendance_mode and session_link columns to groups table
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS attendance_mode text DEFAULT 'offline',
ADD COLUMN IF NOT EXISTS session_link text;