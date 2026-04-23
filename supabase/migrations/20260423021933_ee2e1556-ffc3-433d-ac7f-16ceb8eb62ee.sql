
-- 1. Add tracking_code column with auto-generation
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS tracking_code TEXT;

-- Generate tracking codes for any existing rows
UPDATE public.job_applications
SET tracking_code = 'KJB-' || UPPER(SUBSTRING(MD5(id::text || random()::text) FROM 1 FOR 6))
WHERE tracking_code IS NULL;

-- Make it NOT NULL + unique
ALTER TABLE public.job_applications
  ALTER COLUMN tracking_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS job_applications_tracking_code_uniq
  ON public.job_applications (tracking_code);

-- Default for new rows
CREATE OR REPLACE FUNCTION public.generate_application_tracking_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_attempts INT := 0;
BEGIN
  IF NEW.tracking_code IS NOT NULL AND NEW.tracking_code != '' THEN
    RETURN NEW;
  END IF;

  LOOP
    v_code := 'KJB-' || UPPER(SUBSTRING(MD5(gen_random_uuid()::text || clock_timestamp()::text) FROM 1 FOR 6));
    BEGIN
      NEW.tracking_code := v_code;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_attempts := v_attempts + 1;
      IF v_attempts > 10 THEN
        RAISE EXCEPTION 'Failed to generate unique tracking_code after 10 attempts';
      END IF;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_application_tracking_code ON public.job_applications;
CREATE TRIGGER trg_generate_application_tracking_code
  BEFORE INSERT ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_application_tracking_code();

-- 2. Prevent duplicate applications (same email per job)
CREATE UNIQUE INDEX IF NOT EXISTS job_applications_unique_email_per_job
  ON public.job_applications (job_id, LOWER(applicant_email));

-- 3. Add status-change email event to catalog
INSERT INTO public.email_event_catalog
  (event_key, category, display_name_en, display_name_ar, description, supported_audiences, available_variables, preview_data, is_active)
VALUES (
  'job-application-status-changed',
  'recruitment',
  'Job Application Status Changed',
  'تغيّر حالة طلب التوظيف',
  'Sent to applicant when admin updates their application status',
  ARRAY['staff'],
  '["applicant_name","job_title","job_title_ar","old_status","new_status","new_status_ar","tracking_code","tracking_url","app_url"]'::jsonb,
  '{"applicant_name":"Ahmed","job_title":"Programming Trainer","job_title_ar":"مدرب برمجة","old_status":"new","new_status":"shortlisted","new_status_ar":"قائمة مختصرة","tracking_code":"KJB-A7X2K9","tracking_url":"https://kojobot.com/application-status?code=KJB-A7X2K9","app_url":"https://kojobot.com"}'::jsonb,
  true
)
ON CONFLICT (event_key) DO NOTHING;

-- 4. Add default mapping
INSERT INTO public.email_event_mappings
  (event_key, audience, send_to, admin_channel_override, is_enabled, use_db_template)
VALUES (
  'job-application-status-changed',
  'staff',
  'user',
  'both',
  true,
  false
)
ON CONFLICT DO NOTHING;

-- 5. Trigger that calls send-email when status changes (excluding initial 'new')
CREATE OR REPLACE FUNCTION public.notify_application_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_job RECORD;
  v_status_ar TEXT;
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_payload JSONB;
BEGIN
  -- Only fire when status actually changed and is not the initial state
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'new' THEN
    RETURN NEW;
  END IF;

  -- Lookup job details
  SELECT title_en, title_ar INTO v_job
  FROM public.jobs WHERE id = NEW.job_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Map status to Arabic
  v_status_ar := CASE NEW.status::text
    WHEN 'new' THEN 'جديد'
    WHEN 'under_review' THEN 'قيد المراجعة'
    WHEN 'shortlisted' THEN 'قائمة مختصرة'
    WHEN 'interviewing' THEN 'مقابلة'
    WHEN 'hired' THEN 'تم التوظيف'
    WHEN 'rejected' THEN 'مرفوض'
    ELSE NEW.status::text
  END;

  -- Get vault secrets for HTTP call
  SELECT decrypted_secret INTO v_supabase_url
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;

  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
    RAISE WARNING 'notify_application_status_change: vault secrets missing';
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'to', NEW.applicant_email,
    'templateName', 'job-application-status-changed',
    'audience', 'staff',
    'idempotencyKey', 'app-status-' || NEW.id::text || '-' || NEW.status::text,
    'templateData', jsonb_build_object(
      'applicant_name', NEW.applicant_name,
      'job_title', v_job.title_en,
      'job_title_ar', v_job.title_ar,
      'old_status', OLD.status::text,
      'new_status', NEW.status::text,
      'new_status_ar', v_status_ar,
      'tracking_code', NEW.tracking_code,
      'tracking_url', 'https://kojobot.com/application-status?code=' || NEW.tracking_code,
      'app_url', 'https://kojobot.com'
    )
  );

  -- Fire-and-forget HTTP call to send-email edge function
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := v_payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_application_status_change failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_application_status_change ON public.job_applications;
CREATE TRIGGER trg_notify_application_status_change
  AFTER UPDATE OF status ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_application_status_change();

-- 6. Public RPC: get application status by tracking code
CREATE OR REPLACE FUNCTION public.get_application_status_by_code(p_code TEXT)
RETURNS TABLE (
  applicant_name TEXT,
  job_title_en TEXT,
  job_title_ar TEXT,
  job_slug TEXT,
  status TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  tracking_code TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.applicant_name,
    j.title_en,
    j.title_ar,
    j.slug,
    a.status::text,
    a.submitted_at,
    a.reviewed_at,
    a.tracking_code
  FROM public.job_applications a
  JOIN public.jobs j ON j.id = a.job_id
  WHERE a.tracking_code = UPPER(TRIM(p_code))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_application_status_by_code(TEXT) TO anon, authenticated;
