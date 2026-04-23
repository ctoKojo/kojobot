
DROP FUNCTION IF EXISTS public.get_application_status_by_code(text);

CREATE OR REPLACE FUNCTION public.get_application_status_by_code(p_code text)
RETURNS TABLE (
  applicant_name text,
  job_title_en text,
  job_title_ar text,
  job_slug text,
  status text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  tracking_code text,
  interview_scheduled_at timestamptz,
  interview_duration_minutes int,
  interview_mode text,
  interview_meeting_link text,
  interview_location text,
  interview_notes text,
  interview_confirm_token text,
  interview_confirmed_at timestamptz,
  interview_reschedule_requested_at timestamptz,
  rejection_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.applicant_name,
    j.title_en,
    j.title_ar,
    j.slug,
    a.status::text,
    a.submitted_at,
    a.reviewed_at,
    a.tracking_code,
    i.scheduled_at,
    i.duration_minutes,
    i.mode::text,
    i.meeting_link,
    i.location,
    i.notes,
    i.confirm_token,
    i.applicant_confirmed_at,
    i.reschedule_requested_at,
    a.rejection_reason
  FROM job_applications a
  JOIN jobs j ON j.id = a.job_id
  LEFT JOIN LATERAL (
    SELECT *
    FROM job_interviews ji
    WHERE ji.application_id = a.id
      AND ji.cancelled_by_applicant_at IS NULL
    ORDER BY ji.scheduled_at DESC
    LIMIT 1
  ) i ON TRUE
  WHERE upper(a.tracking_code) = upper(p_code);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_application_status_by_code(text) TO anon, authenticated;
