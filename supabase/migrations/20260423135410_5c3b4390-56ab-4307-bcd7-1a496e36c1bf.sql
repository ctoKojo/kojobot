
-- 1. job_interviews table
CREATE TABLE public.job_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 30 CHECK (duration_minutes > 0 AND duration_minutes <= 480),
  mode text NOT NULL CHECK (mode IN ('online','onsite','phone')),
  meeting_link text,
  location text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  outcome text CHECK (outcome IS NULL OR outcome IN ('pass','fail','another_round')),
  notes text,
  reminder_24h_sent_at timestamptz,
  reminder_1h_sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_interviews_application ON public.job_interviews(application_id);
CREATE INDEX idx_job_interviews_scheduled_at ON public.job_interviews(scheduled_at) WHERE status = 'scheduled';

ALTER TABLE public.job_interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and reception can manage interviews"
ON public.job_interviews
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reception'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reception'));

CREATE TRIGGER update_job_interviews_updated_at
BEFORE UPDATE ON public.job_interviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. job_rejection_reasons table
CREATE TABLE public.job_rejection_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label_en text NOT NULL,
  label_ar text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_rejection_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active rejection reasons"
ON public.job_rejection_reasons
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage rejection reasons"
ON public.job_rejection_reasons
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed
INSERT INTO public.job_rejection_reasons (code, label_en, label_ar, sort_order) VALUES
  ('insufficient_experience', 'Insufficient experience', 'الخبرة غير كافية', 10),
  ('mismatched_specialization', 'Specialization not matching', 'التخصص غير مطابق', 20),
  ('location', 'Geographic location', 'الموقع الجغرافي', 30),
  ('salary_expectations', 'Salary expectations', 'الراتب المتوقع', 40),
  ('mismatched_requirements', 'Does not meet requirements', 'غير مطابق للمتطلبات', 50),
  ('future_opportunities', 'Keep CV for future opportunities', 'الاحتفاظ بالـ CV لفرص مستقبلية', 60),
  ('withdrew', 'Applicant withdrew', 'انسحب المتقدم', 70),
  ('other', 'Other', 'أخرى', 99);

-- 3. Alter job_applications
ALTER TABLE public.job_applications
  ADD COLUMN rejection_reason_code text REFERENCES public.job_rejection_reasons(code) ON DELETE SET NULL,
  ADD COLUMN rejection_notes text,
  ADD COLUMN converted_employee_id uuid,
  ADD COLUMN hire_start_date date,
  ADD COLUMN hire_role text CHECK (hire_role IS NULL OR hire_role IN ('instructor','reception'));

-- 4. KPI RPC
CREATE OR REPLACE FUNCTION public.get_recruitment_metrics(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from timestamptz := COALESCE(p_date_from, (now() - interval '90 days')::date)::timestamptz;
  v_to timestamptz := COALESCE(p_date_to + interval '1 day', now() + interval '1 day');
  v_total_applicants int;
  v_hired_count int;
  v_avg_time_to_hire_days numeric;
  v_total_interviews int;
  v_no_show_count int;
BEGIN
  -- Authorize: admin or reception only
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reception')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT count(*) INTO v_total_applicants
  FROM public.job_applications
  WHERE submitted_at >= v_from AND submitted_at < v_to;

  SELECT count(*) INTO v_hired_count
  FROM public.job_applications
  WHERE submitted_at >= v_from AND submitted_at < v_to AND status = 'hired';

  SELECT AVG(EXTRACT(EPOCH FROM (updated_at - submitted_at)) / 86400.0)
  INTO v_avg_time_to_hire_days
  FROM public.job_applications
  WHERE submitted_at >= v_from AND submitted_at < v_to AND status = 'hired';

  SELECT count(*) INTO v_total_interviews
  FROM public.job_interviews
  WHERE scheduled_at >= v_from AND scheduled_at < v_to;

  SELECT count(*) INTO v_no_show_count
  FROM public.job_interviews
  WHERE scheduled_at >= v_from AND scheduled_at < v_to AND status = 'no_show';

  RETURN jsonb_build_object(
    'total_applicants', v_total_applicants,
    'hired_count', v_hired_count,
    'conversion_rate', CASE WHEN v_total_applicants > 0 THEN ROUND((v_hired_count::numeric / v_total_applicants) * 100, 1) ELSE 0 END,
    'avg_time_to_hire_days', COALESCE(ROUND(v_avg_time_to_hire_days, 1), 0),
    'total_interviews', v_total_interviews,
    'no_show_count', v_no_show_count,
    'no_show_rate', CASE WHEN v_total_interviews > 0 THEN ROUND((v_no_show_count::numeric / v_total_interviews) * 100, 1) ELSE 0 END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_recruitment_metrics(date, date) TO authenticated;
