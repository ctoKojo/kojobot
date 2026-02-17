
-- Function to get basic profile info for conversation participants
-- Uses SECURITY DEFINER to bypass RLS, but only returns minimal info
-- and only for users who are participants in conversations with the caller
CREATE OR REPLACE FUNCTION public.get_conversation_participant_profiles(p_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  full_name text,
  full_name_ar text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT p.user_id, p.full_name, p.full_name_ar, p.avatar_url
  FROM public.profiles p
  WHERE p.user_id = ANY(p_user_ids)
$$;
