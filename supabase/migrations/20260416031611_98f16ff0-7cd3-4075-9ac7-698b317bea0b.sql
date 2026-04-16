
-- Drop old function with different return type
DROP FUNCTION IF EXISTS public.detect_orphan_users();

-- Recreate with state-based classification
CREATE OR REPLACE FUNCTION public.detect_orphan_users()
RETURNS TABLE(user_id uuid, email text, created_at timestamptz, provider text, classification text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::text,
    u.created_at,
    COALESCE(u.raw_app_meta_data->>'provider', 'email')::text AS provider,
    CASE
      WHEN u.created_at > now() - interval '10 minutes'
        THEN 'pending_signup'
      WHEN EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = u.id AND ur.role = 'parent'
      ) THEN 'parent_in_progress'
      WHEN COALESCE(u.raw_app_meta_data->>'provider', 'email') = 'google'
        THEN 'parent_in_progress'
      ELSE 'stale_orphan'
    END AS classification
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE p.user_id IS NULL;
END;
$$;

-- Update heal to skip parents and recent signups
CREATE OR REPLACE FUNCTION public.heal_orphan_users()
RETURNS TABLE(healed_user_id uuid, healed_email text, action_taken text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT u.id, u.email, u.raw_user_meta_data,
           COALESCE(u.raw_app_meta_data->>'provider', 'email') AS provider
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE p.user_id IS NULL
      AND u.created_at < now() - interval '10 minutes'
  LOOP
    IF rec.provider = 'google' THEN
      healed_user_id := rec.id;
      healed_email := rec.email;
      action_taken := 'skipped_parent_candidate';
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = rec.id AND ur.role = 'parent'
    ) THEN
      healed_user_id := rec.id;
      healed_email := rec.email;
      action_taken := 'skipped_parent_role';
      RETURN NEXT;
      CONTINUE;
    END IF;

    INSERT INTO public.profiles (user_id, email, full_name, full_name_ar)
    VALUES (
      rec.id, rec.email,
      COALESCE(rec.raw_user_meta_data->>'full_name', rec.email),
      COALESCE(rec.raw_user_meta_data->>'full_name', rec.email)
    )
    ON CONFLICT (user_id) DO NOTHING;

    healed_user_id := rec.id;
    healed_email := rec.email;
    action_taken := 'profile_created';
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$;
