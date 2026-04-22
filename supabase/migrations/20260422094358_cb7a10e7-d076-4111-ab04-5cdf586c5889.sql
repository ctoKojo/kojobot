CREATE OR REPLACE FUNCTION public.generate_telegram_link_code()
 RETURNS TABLE(code text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_code text;
  v_expires timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE public.telegram_link_codes
    SET used_at = now()
    WHERE user_id = v_user AND used_at IS NULL;

  -- Use gen_random_uuid (available by default) instead of gen_random_bytes (requires pgcrypto)
  -- Strip dashes, uppercase, replace confusing chars, take first 6
  v_code := upper(substring(translate(replace(gen_random_uuid()::text, '-', ''), 'oil0', 'XYZ1') from 1 for 6));
  v_expires := now() + interval '15 minutes';

  INSERT INTO public.telegram_link_codes (user_id, code, expires_at)
    VALUES (v_user, v_code, v_expires);

  RETURN QUERY SELECT v_code, v_expires;
END;
$function$;