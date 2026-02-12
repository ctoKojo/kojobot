
-- Add work_type, is_paid_trainee, hourly_rate columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN work_type text DEFAULT 'full_time',
  ADD COLUMN is_paid_trainee boolean DEFAULT false,
  ADD COLUMN hourly_rate numeric;
