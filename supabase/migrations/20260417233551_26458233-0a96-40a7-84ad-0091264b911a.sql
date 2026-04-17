-- Tighten EXECUTE privileges (least-privilege)
REVOKE ALL ON FUNCTION public.private_get_cron_secret() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.private_get_cron_secret() FROM anon, authenticated;

-- Allow only service_role and postgres (cron runs as postgres superuser)
GRANT EXECUTE ON FUNCTION public.private_get_cron_secret() TO service_role;