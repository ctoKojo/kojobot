
-- 1. Create the official identity read view
CREATE OR REPLACE VIEW public.vw_user_identity AS
SELECT
  p.user_id,
  p.full_name,
  p.full_name_ar,
  p.email,
  p.avatar_url,
  p.phone,
  p.date_of_birth,
  p.specialization,
  p.specialization_ar,
  p.employment_status,
  p.level_id,
  p.needs_renewal,
  p.is_approved,
  p.is_paid_trainee,
  p.hourly_rate,
  ur.role
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id;

-- 2. Validation trigger: ensure user_id exists in auth.users on every insert/update
CREATE OR REPLACE FUNCTION public.validate_profile_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'profiles.user_id cannot be NULL';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.user_id) THEN
    RAISE EXCEPTION 'profiles.user_id % does not exist in auth.users', NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_profile_user_id ON public.profiles;
CREATE TRIGGER trg_validate_profile_user_id
  BEFORE INSERT OR UPDATE OF user_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_user_id();

-- 3. Add NOT NULL constraint on user_id if not already set
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.profiles ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- 4. Daily orphan detection function (can be called by cron)
CREATE OR REPLACE FUNCTION public.detect_orphan_users()
RETURNS TABLE(orphan_user_id uuid, orphan_email text, issue text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Auth users without profiles
  SELECT u.id, u.email::text, 'auth_without_profile'::text
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE p.user_id IS NULL

  UNION ALL

  -- User roles without profiles
  SELECT ur.user_id, 'unknown'::text, 'role_without_profile'::text
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE p.user_id IS NULL;
$$;
