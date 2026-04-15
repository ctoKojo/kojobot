
-- Create a wrapper function for advisory locks (used by grade-quiz to prevent race conditions)
CREATE OR REPLACE FUNCTION public.pg_advisory_xact_lock_wrapper(lock_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(lock_key));
END;
$$;

-- Only allow authenticated users to call this
REVOKE ALL ON FUNCTION public.pg_advisory_xact_lock_wrapper(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pg_advisory_xact_lock_wrapper(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pg_advisory_xact_lock_wrapper(text) TO service_role;
