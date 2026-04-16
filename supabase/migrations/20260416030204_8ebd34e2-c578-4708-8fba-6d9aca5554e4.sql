
-- Fix: recreate view with SECURITY INVOKER (default, explicit for clarity)
DROP VIEW IF EXISTS public.vw_user_identity;
CREATE VIEW public.vw_user_identity
WITH (security_invoker = true)
AS
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
