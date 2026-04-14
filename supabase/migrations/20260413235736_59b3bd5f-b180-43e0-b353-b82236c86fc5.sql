
-- Add is_approved column to profiles (default true so existing accounts are unaffected)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT true;
