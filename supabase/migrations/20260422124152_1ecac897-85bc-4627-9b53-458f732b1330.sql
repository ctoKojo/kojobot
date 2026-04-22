CREATE OR REPLACE FUNCTION public._tmp_bulk_upsert_email_templates(p_payload jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH incoming AS (
    SELECT
      (t->>'name')::text AS name,
      NULLIF(t->>'description','')::text AS description,
      COALESCE(NULLIF(t->>'audience',''), 'student')::text AS audience,
      (t->>'subject_en')::text AS subject_en,
      (t->>'subject_ar')::text AS subject_ar,
      (t->>'body_html_en')::text AS body_html_en,
      (t->>'body_html_ar')::text AS body_html_ar,
      NULLIF(t->>'subject_telegram_en','')::text AS subject_telegram_en,
      NULLIF(t->>'subject_telegram_ar','')::text AS subject_telegram_ar,
      NULLIF(t->>'body_telegram_md_en','')::text AS body_telegram_md_en,
      NULLIF(t->>'body_telegram_md_ar','')::text AS body_telegram_md_ar,
      COALESCE((t->>'is_active')::boolean, true) AS is_active
    FROM jsonb_array_elements(p_payload -> 'templates') AS t
  ),
  upsert AS (
    INSERT INTO public.email_templates (
      name, description, audience, subject_en, subject_ar,
      body_html_en, body_html_ar,
      subject_telegram_en, subject_telegram_ar,
      body_telegram_md_en, body_telegram_md_ar,
      is_active
    )
    SELECT * FROM incoming
    ON CONFLICT (name) DO UPDATE SET
      description = EXCLUDED.description,
      audience = EXCLUDED.audience,
      subject_en = EXCLUDED.subject_en,
      subject_ar = EXCLUDED.subject_ar,
      body_html_en = EXCLUDED.body_html_en,
      body_html_ar = EXCLUDED.body_html_ar,
      subject_telegram_en = EXCLUDED.subject_telegram_en,
      subject_telegram_ar = EXCLUDED.subject_telegram_ar,
      body_telegram_md_en = EXCLUDED.body_telegram_md_en,
      body_telegram_md_ar = EXCLUDED.body_telegram_md_ar,
      is_active = EXCLUDED.is_active,
      updated_at = now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM upsert;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public._tmp_bulk_upsert_email_templates(jsonb) TO authenticated, service_role, anon;