
-- RPC: Confirm interview by token (public, no auth required)
CREATE OR REPLACE FUNCTION public.confirm_interview_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_interview record;
BEGIN
  SELECT id, application_id, scheduled_at, applicant_confirmed_at, cancelled_by_applicant_at
  INTO v_interview
  FROM job_interviews
  WHERE confirm_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  IF v_interview.cancelled_by_applicant_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'cancelled');
  END IF;

  IF v_interview.applicant_confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_confirmed', true);
  END IF;

  UPDATE job_interviews
  SET applicant_confirmed_at = now()
  WHERE id = v_interview.id;

  RETURN jsonb_build_object('success', true, 'already_confirmed', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_interview_by_token(text) TO anon, authenticated;

-- RPC: Request reschedule by token (public, no auth required)
CREATE OR REPLACE FUNCTION public.request_reschedule_by_token(p_token text, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_interview record;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'reason_too_short');
  END IF;

  SELECT id, application_id, applicant_confirmed_at, cancelled_by_applicant_at, reschedule_requested_at
  INTO v_interview
  FROM job_interviews
  WHERE confirm_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  IF v_interview.cancelled_by_applicant_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'cancelled');
  END IF;

  IF v_interview.applicant_confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_confirmed');
  END IF;

  UPDATE job_interviews
  SET reschedule_requested_at = now(),
      reschedule_reason = p_reason
  WHERE id = v_interview.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_reschedule_by_token(text, text) TO anon, authenticated;
