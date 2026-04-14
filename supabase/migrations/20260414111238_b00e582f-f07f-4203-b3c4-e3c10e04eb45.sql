CREATE OR REPLACE FUNCTION public.get_parent_auth_info(parent_ids uuid[])
RETURNS TABLE(user_id uuid, email text, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    au.id as user_id,
    au.email::text,
    COALESCE(
      au.raw_user_meta_data->>'full_name',
      au.raw_user_meta_data->>'name',
      split_part(au.email::text, '@', 1)
    ) as full_name
  FROM auth.users au
  WHERE au.id = ANY(parent_ids)
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = au.id AND ur.role = 'parent'
    );
$$;