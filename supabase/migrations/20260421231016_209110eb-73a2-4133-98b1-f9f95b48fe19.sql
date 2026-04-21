-- Catalog of supported events
CREATE TABLE IF NOT EXISTS public.email_event_catalog (
  event_key text PRIMARY KEY,
  category text NOT NULL,
  display_name_en text NOT NULL,
  display_name_ar text NOT NULL,
  description text,
  available_variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  subject_en text NOT NULL,
  subject_ar text NOT NULL,
  body_html_en text NOT NULL,
  body_html_ar text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_event_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL REFERENCES public.email_event_catalog(event_key) ON DELETE CASCADE,
  template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  use_db_template boolean NOT NULL DEFAULT false,
  is_enabled boolean NOT NULL DEFAULT true,
  send_to text NOT NULL DEFAULT 'student',
  trigger_offset_minutes integer,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_key)
);

CREATE INDEX IF NOT EXISTS idx_email_templates_active ON public.email_templates (is_active);
CREATE INDEX IF NOT EXISTS idx_event_mappings_event ON public.email_event_mappings (event_key);

CREATE OR REPLACE FUNCTION public.touch_email_template_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_touch_email_templates ON public.email_templates;
CREATE TRIGGER trg_touch_email_templates
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_email_template_updated_at();

DROP TRIGGER IF EXISTS trg_touch_event_mappings ON public.email_event_mappings;
CREATE TRIGGER trg_touch_event_mappings
  BEFORE UPDATE ON public.email_event_mappings
  FOR EACH ROW EXECUTE FUNCTION public.touch_email_template_updated_at();

ALTER TABLE public.email_event_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_event_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage event catalog" ON public.email_event_catalog;
CREATE POLICY "admins manage event catalog" ON public.email_event_catalog
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "staff read event catalog" ON public.email_event_catalog;
CREATE POLICY "staff read event catalog" ON public.email_event_catalog
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reception'));

DROP POLICY IF EXISTS "admins manage templates" ON public.email_templates;
CREATE POLICY "admins manage templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "staff read templates" ON public.email_templates;
CREATE POLICY "staff read templates" ON public.email_templates
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reception'));

DROP POLICY IF EXISTS "admins manage event mappings" ON public.email_event_mappings;
CREATE POLICY "admins manage event mappings" ON public.email_event_mappings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "staff read event mappings" ON public.email_event_mappings;
CREATE POLICY "staff read event mappings" ON public.email_event_mappings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reception'));