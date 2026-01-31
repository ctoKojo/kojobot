-- Fix the function search path for get_group_max_students
CREATE OR REPLACE FUNCTION public.get_group_max_students(g_type public.group_type)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE g_type
    WHEN 'kojo_squad' THEN 8
    WHEN 'kojo_core' THEN 3
    WHEN 'kojo_x' THEN 1
  END
$$;