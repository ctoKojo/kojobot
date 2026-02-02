-- Create enum for instructor employment status
CREATE TYPE public.employment_status AS ENUM ('permanent', 'training');

-- Add employment_status column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN employment_status public.employment_status DEFAULT 'training';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.employment_status IS 'Instructor employment status: permanent (مثبت) or training (تدريب)';