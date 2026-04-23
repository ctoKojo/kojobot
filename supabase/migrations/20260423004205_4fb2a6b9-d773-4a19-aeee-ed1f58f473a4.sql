-- ENUMS
CREATE TYPE public.job_type AS ENUM ('full_time', 'part_time', 'internship', 'summer_training', 'volunteer', 'freelance');
CREATE TYPE public.job_status AS ENUM ('draft', 'published', 'closed', 'archived');
CREATE TYPE public.job_application_status AS ENUM ('new', 'under_review', 'shortlisted', 'interviewing', 'hired', 'rejected');
CREATE TYPE public.job_invite_status AS ENUM ('sent', 'opened', 'applied', 'expired');

-- JOBS
CREATE TABLE public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  type public.job_type NOT NULL DEFAULT 'full_time',
  location_en TEXT,
  location_ar TEXT,
  salary_range TEXT,
  description_en TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  requirements_en TEXT,
  requirements_ar TEXT,
  benefits_en TEXT,
  benefits_ar TEXT,
  form_fields JSONB NOT NULL DEFAULT '[
    {"key":"full_name","type":"short_text","label_en":"Full Name","label_ar":"الاسم الكامل","required":true},
    {"key":"email","type":"email","label_en":"Email","label_ar":"البريد الإلكتروني","required":true},
    {"key":"phone","type":"phone","label_en":"Phone","label_ar":"رقم الهاتف","required":true},
    {"key":"cv","type":"file_upload","label_en":"CV / Resume","label_ar":"السيرة الذاتية","required":true,"accept":".pdf,.doc,.docx"},
    {"key":"motivation","type":"long_text","label_en":"Why do you want to join us?","label_ar":"لماذا ترغب في الانضمام إلينا؟","required":true}
  ]'::jsonb,
  status public.job_status NOT NULL DEFAULT 'draft',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  posted_at TIMESTAMPTZ,
  deadline_at TIMESTAMPTZ,
  applications_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_jobs_slug ON public.jobs(slug);
CREATE INDEX idx_jobs_deadline ON public.jobs(deadline_at) WHERE status = 'published';

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active published jobs"
ON public.jobs FOR SELECT
USING (status = 'published' AND (deadline_at IS NULL OR deadline_at >= now()));

CREATE POLICY "Admins manage jobs"
ON public.jobs FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'reception'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'reception'::app_role));

-- APPLICATIONS
CREATE TABLE public.job_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  applicant_phone TEXT,
  cv_url TEXT,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.job_application_status NOT NULL DEFAULT 'new',
  source TEXT NOT NULL DEFAULT 'direct' CHECK (source IN ('direct', 'invite')),
  invite_id UUID,
  admin_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_applications_job_id ON public.job_applications(job_id);
CREATE INDEX idx_job_applications_status ON public.job_applications(status);
CREATE INDEX idx_job_applications_email ON public.job_applications(applicant_email);
CREATE INDEX idx_job_applications_submitted_at ON public.job_applications(submitted_at DESC);

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage applications"
ON public.job_applications FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'reception'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'reception'::app_role));

-- INVITES
CREATE TABLE public.job_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  personal_message TEXT,
  invited_by UUID NOT NULL,
  status public.job_invite_status NOT NULL DEFAULT 'sent',
  opened_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_invites_token ON public.job_invites(token);
CREATE INDEX idx_job_invites_job_id ON public.job_invites(job_id);
CREATE INDEX idx_job_invites_email ON public.job_invites(email);

ALTER TABLE public.job_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage invites"
ON public.job_invites FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'reception'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'reception'::app_role));

-- TRIGGERS
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_applications_updated_at BEFORE UPDATE ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_job_posted_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'published' AND OLD.status != 'published' AND NEW.posted_at IS NULL THEN
    NEW.posted_at := now();
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_set_job_posted_at BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.set_job_posted_at();

CREATE OR REPLACE FUNCTION public.increment_job_applications_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.jobs SET applications_count = applications_count + 1 WHERE id = NEW.job_id;
  IF NEW.invite_id IS NOT NULL THEN
    UPDATE public.job_invites SET status = 'applied', applied_at = now() WHERE id = NEW.invite_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_increment_job_applications_count AFTER INSERT ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.increment_job_applications_count();

-- STORAGE
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-applications', 'job-applications', false, 5242880,
  ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png']
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins read job applications storage"
ON storage.objects FOR SELECT
USING (bucket_id = 'job-applications' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'reception'::app_role)));

-- EMAIL EVENT CATALOG
INSERT INTO public.email_event_catalog (event_key, category, display_name_en, display_name_ar, description, supported_audiences, available_variables, preview_data, is_active)
VALUES 
  ('job-application-received', 'careers', 'Job Application Received', 'تأكيد استلام طلب التوظيف', 'Sent to applicant after submitting a job application', ARRAY['staff'],
   '["applicant_name","job_title","job_title_ar","application_id","app_url"]'::jsonb,
   '{"applicant_name":"أحمد محمد","job_title":"Software Engineer","job_title_ar":"مهندس برمجيات","application_id":"abc-123","app_url":"https://kojobot.com"}'::jsonb, true),
  ('job-invite-to-apply', 'careers', 'Job Invite to Apply', 'دعوة للتقديم على وظيفة', 'Direct invite sent by admin to apply for a job', ARRAY['staff'],
   '["recipient_email","job_title","job_title_ar","personal_message","apply_url","expires_at"]'::jsonb,
   '{"recipient_email":"candidate@example.com","job_title":"Frontend Developer","job_title_ar":"مطور واجهات أمامية","personal_message":"شفنا شغلك وعجبنا","apply_url":"https://kojobot.com/apply/abc123","expires_at":"2025-12-31"}'::jsonb, true),
  ('admin-new-job-application', 'careers', 'Admin: New Job Application', 'إشعار: طلب توظيف جديد', 'Admin notification for new job application', ARRAY['admin'],
   '["applicant_name","applicant_email","job_title","job_title_ar","application_url"]'::jsonb,
   '{"applicant_name":"أحمد محمد","applicant_email":"ahmed@example.com","job_title":"Software Engineer","job_title_ar":"مهندس برمجيات","application_url":"https://kojobot.com/admin/jobs/123"}'::jsonb, true)
ON CONFLICT (event_key) DO NOTHING;

-- TEMPLATES (subject_en/ar and body_html_en/ar are NOT NULL — admin template uses placeholders)
INSERT INTO public.email_templates (name, audience, subject_en, subject_ar, body_html_en, body_html_ar, body_telegram_md_en, body_telegram_md_ar, subject_telegram_en, subject_telegram_ar, is_active, description)
VALUES
  ('job-application-received', 'staff',
    'We received your application — {{job_title}}',
    'تم استلام طلبك — {{job_title_ar}}',
    '<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px"><h2>Hi {{applicant_name}},</h2><p>Thank you for applying to <strong>{{job_title}}</strong> at Kojobot Academy.</p><p>We received your application successfully. Our team will review it and get back to you soon.</p><p>Best regards,<br/>Kojobot Team</p></div>',
    '<div style="font-family:Cairo,sans-serif;max-width:600px;margin:0 auto;padding:24px;direction:rtl"><h2>أهلاً {{applicant_name}}،</h2><p>شكراً لتقديمك على وظيفة <strong>{{job_title_ar}}</strong> في أكاديمية Kojobot.</p><p>تم استلام طلبك بنجاح. هيراجعه فريقنا ونتواصل معاك قريباً.</p><p>تحياتنا،<br/>فريق Kojobot</p></div>',
    NULL, NULL, NULL, NULL, true, 'Confirmation email sent to applicants after submitting a job application'),
  ('job-invite-to-apply', 'staff',
    'You''re invited to apply — {{job_title}}',
    'دعوة للتقديم على وظيفة — {{job_title_ar}}',
    '<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px"><h2>You''re invited!</h2><p>We''d love for you to apply for <strong>{{job_title}}</strong> at Kojobot Academy.</p><p style="margin:24px 0"><a href="{{apply_url}}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Apply Now</a></p><p style="color:#64748b;font-size:14px">This invite expires on {{expires_at}}.</p></div>',
    '<div style="font-family:Cairo,sans-serif;max-width:600px;margin:0 auto;padding:24px;direction:rtl"><h2>إنت مدعو!</h2><p>يسعدنا تقديمك على وظيفة <strong>{{job_title_ar}}</strong> في أكاديمية Kojobot.</p><p style="margin:24px 0"><a href="{{apply_url}}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">قدّم الآن</a></p><p style="color:#64748b;font-size:14px">الدعوة سارية حتى {{expires_at}}.</p></div>',
    NULL, NULL, NULL, NULL, true, 'Direct invitation sent to specific candidates'),
  ('admin-new-job-application', 'admin',
    'New Job Application: {{job_title}}',
    'طلب توظيف جديد: {{job_title_ar}}',
    '<p>New application from {{applicant_name}} ({{applicant_email}}) for {{job_title}}. <a href="{{application_url}}">View</a></p>',
    '<p dir="rtl">طلب جديد من {{applicant_name}} ({{applicant_email}}) لوظيفة {{job_title_ar}}. <a href="{{application_url}}">عرض</a></p>',
    '📥 *New Job Application*

*Job:* {{job_title}}
*Applicant:* {{applicant_name}}
*Email:* {{applicant_email}}

[View Application]({{application_url}})',
    '📥 *طلب توظيف جديد*

*الوظيفة:* {{job_title_ar}}
*المتقدم:* {{applicant_name}}
*الإيميل:* {{applicant_email}}

[عرض الطلب]({{application_url}})',
    'New Job Application: {{job_title}}',
    'طلب توظيف جديد: {{job_title_ar}}',
    true, 'Telegram alert to admins when a new job application arrives')
ON CONFLICT (name) DO NOTHING;

-- MAPPINGS
INSERT INTO public.email_event_mappings (event_key, audience, template_id, send_to, is_enabled, use_db_template, admin_channel_override)
SELECT 'job-application-received', 'staff', t.id, 'user', true, true, 'email_only'
FROM public.email_templates t WHERE t.name = 'job-application-received'
ON CONFLICT DO NOTHING;

INSERT INTO public.email_event_mappings (event_key, audience, template_id, send_to, is_enabled, use_db_template, admin_channel_override)
SELECT 'job-invite-to-apply', 'staff', t.id, 'user', true, true, 'email_only'
FROM public.email_templates t WHERE t.name = 'job-invite-to-apply'
ON CONFLICT DO NOTHING;

INSERT INTO public.email_event_mappings (event_key, audience, template_id, send_to, is_enabled, use_db_template, admin_channel_override)
SELECT 'admin-new-job-application', 'admin', t.id, 'admin', true, true, 'telegram_only'
FROM public.email_templates t WHERE t.name = 'admin-new-job-application'
ON CONFLICT DO NOTHING;