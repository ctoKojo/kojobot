
-- =========================================================
-- Email Templates: Versioning, Audit Log, Validation Status
-- =========================================================

-- 1) Add columns to email_templates
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS validation_status jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_test_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_test_status text;

-- 2) Add preview_data to event catalog
ALTER TABLE public.email_event_catalog
  ADD COLUMN IF NOT EXISTS preview_data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3) Versions table
CREATE TABLE IF NOT EXISTS public.email_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.email_templates(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  name text NOT NULL,
  description text,
  audience text NOT NULL,
  subject_en text NOT NULL,
  subject_ar text NOT NULL,
  body_html_en text NOT NULL,
  body_html_ar text NOT NULL,
  subject_telegram_en text,
  subject_telegram_ar text,
  body_telegram_md_en text,
  body_telegram_md_ar text,
  is_active boolean NOT NULL DEFAULT true,
  change_note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_email_template_versions_template
  ON public.email_template_versions (template_id, version_number DESC);

ALTER TABLE public.email_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and reception read versions"
  ON public.email_template_versions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'reception'::app_role));

-- 4) Audit log table
CREATE TABLE IF NOT EXISTS public.email_template_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid,
  template_name text,
  actor_id uuid,
  action text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_template_audit_template
  ON public.email_template_audit_log (template_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_template_audit_actor
  ON public.email_template_audit_log (actor_id, created_at DESC);

ALTER TABLE public.email_template_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and reception read audit log"
  ON public.email_template_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'reception'::app_role));

-- 5) Trigger function: snapshot version + audit on email_templates changes
CREATE OR REPLACE FUNCTION public.email_templates_track_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next integer;
  v_changes jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- snapshot v1
    INSERT INTO public.email_template_versions (
      template_id, version_number, name, description, audience,
      subject_en, subject_ar, body_html_en, body_html_ar,
      subject_telegram_en, subject_telegram_ar, body_telegram_md_en, body_telegram_md_ar,
      is_active, change_note, created_by
    ) VALUES (
      NEW.id, 1, NEW.name, NEW.description, NEW.audience,
      NEW.subject_en, NEW.subject_ar, NEW.body_html_en, NEW.body_html_ar,
      NEW.subject_telegram_en, NEW.subject_telegram_ar, NEW.body_telegram_md_en, NEW.body_telegram_md_ar,
      NEW.is_active, 'Initial version', auth.uid()
    );
    INSERT INTO public.email_template_audit_log (template_id, template_name, actor_id, action, changes)
    VALUES (NEW.id, NEW.name, auth.uid(), 'created', jsonb_build_object('audience', NEW.audience));
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- compute diff (only fields that changed)
    IF NEW.name <> OLD.name THEN
      v_changes := v_changes || jsonb_build_object('name', jsonb_build_object('old', OLD.name, 'new', NEW.name));
    END IF;
    IF coalesce(NEW.description,'') <> coalesce(OLD.description,'') THEN
      v_changes := v_changes || jsonb_build_object('description', jsonb_build_object('old', OLD.description, 'new', NEW.description));
    END IF;
    IF NEW.audience <> OLD.audience THEN
      v_changes := v_changes || jsonb_build_object('audience', jsonb_build_object('old', OLD.audience, 'new', NEW.audience));
    END IF;
    IF NEW.subject_en <> OLD.subject_en THEN
      v_changes := v_changes || jsonb_build_object('subject_en', true);
    END IF;
    IF NEW.subject_ar <> OLD.subject_ar THEN
      v_changes := v_changes || jsonb_build_object('subject_ar', true);
    END IF;
    IF NEW.body_html_en <> OLD.body_html_en THEN
      v_changes := v_changes || jsonb_build_object('body_html_en', true);
    END IF;
    IF NEW.body_html_ar <> OLD.body_html_ar THEN
      v_changes := v_changes || jsonb_build_object('body_html_ar', true);
    END IF;
    IF coalesce(NEW.subject_telegram_en,'') <> coalesce(OLD.subject_telegram_en,'') THEN
      v_changes := v_changes || jsonb_build_object('subject_telegram_en', true);
    END IF;
    IF coalesce(NEW.subject_telegram_ar,'') <> coalesce(OLD.subject_telegram_ar,'') THEN
      v_changes := v_changes || jsonb_build_object('subject_telegram_ar', true);
    END IF;
    IF coalesce(NEW.body_telegram_md_en,'') <> coalesce(OLD.body_telegram_md_en,'') THEN
      v_changes := v_changes || jsonb_build_object('body_telegram_md_en', true);
    END IF;
    IF coalesce(NEW.body_telegram_md_ar,'') <> coalesce(OLD.body_telegram_md_ar,'') THEN
      v_changes := v_changes || jsonb_build_object('body_telegram_md_ar', true);
    END IF;
    IF NEW.is_active <> OLD.is_active THEN
      v_changes := v_changes || jsonb_build_object('is_active', jsonb_build_object('old', OLD.is_active, 'new', NEW.is_active));
    END IF;

    -- skip noise: validation_status / last_test_* updates only
    IF v_changes = '{}'::jsonb THEN
      RETURN NEW;
    END IF;

    SELECT coalesce(max(version_number), 0) + 1 INTO v_next
      FROM public.email_template_versions WHERE template_id = NEW.id;

    INSERT INTO public.email_template_versions (
      template_id, version_number, name, description, audience,
      subject_en, subject_ar, body_html_en, body_html_ar,
      subject_telegram_en, subject_telegram_ar, body_telegram_md_en, body_telegram_md_ar,
      is_active, change_note, created_by
    ) VALUES (
      NEW.id, v_next, NEW.name, NEW.description, NEW.audience,
      NEW.subject_en, NEW.subject_ar, NEW.body_html_en, NEW.body_html_ar,
      NEW.subject_telegram_en, NEW.subject_telegram_ar, NEW.body_telegram_md_en, NEW.body_telegram_md_ar,
      NEW.is_active, NULL, auth.uid()
    );

    INSERT INTO public.email_template_audit_log (template_id, template_name, actor_id, action, changes)
    VALUES (
      NEW.id, NEW.name, auth.uid(),
      CASE
        WHEN OLD.is_active = false AND NEW.is_active = true THEN 'activated'
        WHEN OLD.is_active = true AND NEW.is_active = false THEN 'deactivated'
        ELSE 'updated'
      END,
      v_changes
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.email_template_audit_log (template_id, template_name, actor_id, action, changes)
    VALUES (OLD.id, OLD.name, auth.uid(), 'deleted', jsonb_build_object('audience', OLD.audience));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS email_templates_track_changes_trg ON public.email_templates;
CREATE TRIGGER email_templates_track_changes_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.email_templates_track_changes();

-- 6) RPC: restore a version (creates a new HEAD version with same content)
CREATE OR REPLACE FUNCTION public.restore_email_template_version(p_version_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.email_template_versions%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can restore template versions';
  END IF;

  SELECT * INTO v FROM public.email_template_versions WHERE id = p_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version not found';
  END IF;

  UPDATE public.email_templates SET
    name = v.name,
    description = v.description,
    audience = v.audience,
    subject_en = v.subject_en,
    subject_ar = v.subject_ar,
    body_html_en = v.body_html_en,
    body_html_ar = v.body_html_ar,
    subject_telegram_en = v.subject_telegram_en,
    subject_telegram_ar = v.subject_telegram_ar,
    body_telegram_md_en = v.body_telegram_md_en,
    body_telegram_md_ar = v.body_telegram_md_ar,
    is_active = v.is_active,
    updated_at = now()
  WHERE id = v.template_id;

  INSERT INTO public.email_template_audit_log (template_id, template_name, actor_id, action, changes)
  VALUES (v.template_id, v.name, auth.uid(), 'restored',
          jsonb_build_object('restored_from_version', v.version_number));

  RETURN v.template_id;
END;
$$;

-- 7) RPC: import templates batch (transactional, with audit)
-- mode: 'overwrite' | 'skip' | 'duplicate'
CREATE OR REPLACE FUNCTION public.import_email_templates_batch(
  p_payload jsonb,
  p_mode text DEFAULT 'overwrite',
  p_batch_id uuid DEFAULT gen_random_uuid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec jsonb;
  v_existing_id uuid;
  v_new_id uuid;
  v_created int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_duplicated int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_results jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can import templates';
  END IF;

  IF p_mode NOT IN ('overwrite', 'skip', 'duplicate') THEN
    RAISE EXCEPTION 'Invalid mode: %', p_mode;
  END IF;

  FOR rec IN SELECT * FROM jsonb_array_elements(p_payload->'templates')
  LOOP
    BEGIN
      v_existing_id := NULL;
      IF rec ? 'id' AND (rec->>'id') IS NOT NULL THEN
        SELECT id INTO v_existing_id FROM public.email_templates WHERE id = (rec->>'id')::uuid;
      END IF;
      IF v_existing_id IS NULL THEN
        SELECT id INTO v_existing_id FROM public.email_templates WHERE name = (rec->>'name');
      END IF;

      IF v_existing_id IS NOT NULL THEN
        IF p_mode = 'skip' THEN
          v_skipped := v_skipped + 1;
          v_results := v_results || jsonb_build_object('name', rec->>'name', 'action', 'skipped');
          CONTINUE;
        ELSIF p_mode = 'duplicate' THEN
          INSERT INTO public.email_templates (
            name, description, audience,
            subject_en, subject_ar, body_html_en, body_html_ar,
            subject_telegram_en, subject_telegram_ar, body_telegram_md_en, body_telegram_md_ar,
            is_active, created_by
          ) VALUES (
            (rec->>'name') || ' (imported)',
            rec->>'description',
            coalesce(rec->>'audience', 'student'),
            rec->>'subject_en', rec->>'subject_ar',
            rec->>'body_html_en', rec->>'body_html_ar',
            rec->>'subject_telegram_en', rec->>'subject_telegram_ar',
            rec->>'body_telegram_md_en', rec->>'body_telegram_md_ar',
            coalesce((rec->>'is_active')::boolean, true),
            auth.uid()
          ) RETURNING id INTO v_new_id;
          v_duplicated := v_duplicated + 1;
          v_results := v_results || jsonb_build_object('name', rec->>'name', 'action', 'duplicated', 'new_id', v_new_id);
        ELSE
          UPDATE public.email_templates SET
            name = rec->>'name',
            description = rec->>'description',
            audience = coalesce(rec->>'audience', audience),
            subject_en = rec->>'subject_en',
            subject_ar = rec->>'subject_ar',
            body_html_en = rec->>'body_html_en',
            body_html_ar = rec->>'body_html_ar',
            subject_telegram_en = rec->>'subject_telegram_en',
            subject_telegram_ar = rec->>'subject_telegram_ar',
            body_telegram_md_en = rec->>'body_telegram_md_en',
            body_telegram_md_ar = rec->>'body_telegram_md_ar',
            is_active = coalesce((rec->>'is_active')::boolean, is_active),
            updated_at = now()
          WHERE id = v_existing_id;
          v_updated := v_updated + 1;
          v_results := v_results || jsonb_build_object('name', rec->>'name', 'action', 'updated');
        END IF;
      ELSE
        INSERT INTO public.email_templates (
          name, description, audience,
          subject_en, subject_ar, body_html_en, body_html_ar,
          subject_telegram_en, subject_telegram_ar, body_telegram_md_en, body_telegram_md_ar,
          is_active, created_by
        ) VALUES (
          rec->>'name', rec->>'description',
          coalesce(rec->>'audience', 'student'),
          rec->>'subject_en', rec->>'subject_ar',
          rec->>'body_html_en', rec->>'body_html_ar',
          rec->>'subject_telegram_en', rec->>'subject_telegram_ar',
          rec->>'body_telegram_md_en', rec->>'body_telegram_md_ar',
          coalesce((rec->>'is_active')::boolean, true),
          auth.uid()
        ) RETURNING id INTO v_new_id;
        v_created := v_created + 1;
        v_results := v_results || jsonb_build_object('name', rec->>'name', 'action', 'created', 'new_id', v_new_id);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object('name', rec->>'name', 'error', SQLERRM);
    END;
  END LOOP;

  -- batch audit
  INSERT INTO public.email_template_audit_log (template_id, template_name, actor_id, action, changes)
  VALUES (
    NULL, 'BATCH_IMPORT', auth.uid(), 'imported',
    jsonb_build_object(
      'batch_id', p_batch_id,
      'mode', p_mode,
      'created', v_created,
      'updated', v_updated,
      'skipped', v_skipped,
      'duplicated', v_duplicated,
      'errors', v_errors
    )
  );

  RETURN jsonb_build_object(
    'batch_id', p_batch_id,
    'mode', p_mode,
    'created', v_created,
    'updated', v_updated,
    'skipped', v_skipped,
    'duplicated', v_duplicated,
    'errors', v_errors,
    'results', v_results
  );
END;
$$;

-- 8) Backfill: create v1 snapshot for any existing templates that don't have one
INSERT INTO public.email_template_versions (
  template_id, version_number, name, description, audience,
  subject_en, subject_ar, body_html_en, body_html_ar,
  subject_telegram_en, subject_telegram_ar, body_telegram_md_en, body_telegram_md_ar,
  is_active, change_note
)
SELECT
  t.id, 1, t.name, t.description, t.audience,
  t.subject_en, t.subject_ar, t.body_html_en, t.body_html_ar,
  t.subject_telegram_en, t.subject_telegram_ar, t.body_telegram_md_en, t.body_telegram_md_ar,
  t.is_active, 'Backfilled initial version'
FROM public.email_templates t
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_template_versions v WHERE v.template_id = t.id
);
