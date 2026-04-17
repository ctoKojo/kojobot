-- Recreate with explicit immutable search_path (security hardening)
CREATE OR REPLACE FUNCTION public.private_get_cron_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = vault, pg_catalog
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.private_get_cron_secret() FROM PUBLIC, anon, authenticated;