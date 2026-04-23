CREATE OR REPLACE FUNCTION public.set_interview_confirm_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.confirm_token IS NULL THEN
    -- Use two UUIDs concatenated for a 64-char hex token (no pgcrypto dependency)
    NEW.confirm_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  END IF;
  RETURN NEW;
END;
$function$;