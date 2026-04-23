CREATE OR REPLACE FUNCTION public.get_interview_by_token(p_token text)
RETURNS SETOF json LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT row_to_json(t) FROM (
    SELECT i.id, i.scheduled_at, i.duration_minutes, i.mode, i.meeting_link, i.location,
      i.status, i.applicant_confirmed_at, i.reschedule_requested_at, i.reschedule_reason,
      i.cancelled_by_applicant_at, i.notes,
      a.applicant_name, a.applicant_email, j.title_en AS job_title_en, j.title_ar AS job_title_ar
    FROM public.job_interviews i
    JOIN public.job_applications a ON a.id = i.application_id
    JOIN public.jobs j ON j.id = a.job_id
    WHERE i.confirm_token = p_token LIMIT 1
  ) t;
$$;
GRANT EXECUTE ON FUNCTION public.get_interview_by_token(text) TO anon, authenticated;