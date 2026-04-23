CREATE OR REPLACE FUNCTION public.set_interview_confirm_token()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $func$
BEGIN
  IF NEW.confirm_token IS NULL THEN
    NEW.confirm_token := encode(gen_random_bytes(24), 'hex');
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_set_interview_confirm_token ON public.job_interviews;
CREATE TRIGGER trg_set_interview_confirm_token
  BEFORE INSERT ON public.job_interviews
  FOR EACH ROW EXECUTE FUNCTION public.set_interview_confirm_token();