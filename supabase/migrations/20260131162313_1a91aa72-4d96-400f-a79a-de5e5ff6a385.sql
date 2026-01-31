-- Create enum for group types
CREATE TYPE public.group_type AS ENUM ('kojo_squad', 'kojo_core', 'kojo_x');

-- Create enum for subscription types (matching group types)
CREATE TYPE public.subscription_type AS ENUM ('kojo_squad', 'kojo_core', 'kojo_x');

-- Add group_type column to groups table
ALTER TABLE public.groups ADD COLUMN group_type public.group_type NOT NULL DEFAULT 'kojo_squad';

-- Add subscription_type column to profiles table for students
ALTER TABLE public.profiles ADD COLUMN subscription_type public.subscription_type;

-- Create a function to get max students based on group type
CREATE OR REPLACE FUNCTION public.get_group_max_students(g_type public.group_type)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE g_type
    WHEN 'kojo_squad' THEN 8
    WHEN 'kojo_core' THEN 3
    WHEN 'kojo_x' THEN 1
  END
$$;

-- Create a function to get current student count for a group
CREATE OR REPLACE FUNCTION public.get_group_student_count(g_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.group_students
  WHERE group_id = g_id AND is_active = true
$$;