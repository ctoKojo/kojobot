-- 1. Catalog entry
INSERT INTO public.email_event_catalog
  (event_key, category, display_name_en, display_name_ar, description, supported_audiences, available_variables, is_active)
VALUES (
  'admin-weekly-content-gap',
  'admin',
  'Weekly Content Gap Digest',
  'تقرير نواقص المحتوى الأسبوعي',
  'Weekly summary of sessions missing curriculum content, slides, quiz, assignment, or required videos for Core/X groups.',
  ARRAY['admin'],
  '["week_key","week_start","week_end","gaps_count","gaps_table_html","gaps_table_html_ar","gaps_telegram_md"]'::jsonb,
  true
)
ON CONFLICT (event_key) DO UPDATE
SET category = EXCLUDED.category,
    display_name_en = EXCLUDED.display_name_en,
    display_name_ar = EXCLUDED.display_name_ar,
    description = EXCLUDED.description,
    supported_audiences = EXCLUDED.supported_audiences,
    available_variables = EXCLUDED.available_variables,
    is_active = true;

-- 2. Template
INSERT INTO public.email_templates (
  name, audience,
  subject_en, subject_ar,
  body_html_en, body_html_ar,
  subject_telegram_en, subject_telegram_ar,
  body_telegram_md_en, body_telegram_md_ar,
  description, is_active
)
VALUES (
  'admin-weekly-content-gap',
  'admin',
  '⚠️ Weekly content gaps — {{gaps_count}} session(s) need attention',
  '⚠️ نواقص محتوى الأسبوع — {{gaps_count}} سيشن محتاجة مراجعة',
  '<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;padding:24px">
     <h2 style="color:#111">Weekly Content Audit</h2>
     <p style="color:#374151">Week <strong>{{week_key}}</strong> ({{week_start}} → {{week_end}})</p>
     <p style="color:#b91c1c"><strong>{{gaps_count}}</strong> session(s) are missing required content.</p>
     {{gaps_table_html}}
     <p style="color:#6b7280;font-size:12px;margin-top:24px">Open the curriculum and groups pages to fix the gaps before sessions begin.</p>
   </div>',
  '<div dir="rtl" style="font-family:Arial,sans-serif;max-width:680px;margin:auto;padding:24px">
     <h2 style="color:#111">تقرير نواقص المحتوى الأسبوعي</h2>
     <p style="color:#374151">أسبوع <strong>{{week_key}}</strong> ({{week_start}} → {{week_end}})</p>
     <p style="color:#b91c1c"><strong>{{gaps_count}}</strong> سيشن محتاجة محتوى ناقص.</p>
     {{gaps_table_html_ar}}
     <p style="color:#6b7280;font-size:12px;margin-top:24px">افتح صفحات المنهج والمجموعات لاستكمال النواقص قبل بداية السيشنات.</p>
   </div>',
  '⚠️ Weekly content gaps',
  '⚠️ نواقص محتوى الأسبوع',
  '*Weekly Content Audit*
Week: `{{week_key}}` ({{week_start}} → {{week_end}})
Sessions needing attention: *{{gaps_count}}*

{{gaps_telegram_md}}',
  '*تقرير نواقص المحتوى الأسبوعي*
الأسبوع: `{{week_key}}` ({{week_start}} → {{week_end}})
عدد السيشنات الناقصة: *{{gaps_count}}*

{{gaps_telegram_md}}',
  'Weekly digest emailed to admins listing sessions in the current week missing content, slides, quiz, assignment, or videos.',
  true
)
ON CONFLICT (name) DO UPDATE
SET audience = EXCLUDED.audience,
    subject_en = EXCLUDED.subject_en,
    subject_ar = EXCLUDED.subject_ar,
    body_html_en = EXCLUDED.body_html_en,
    body_html_ar = EXCLUDED.body_html_ar,
    subject_telegram_en = EXCLUDED.subject_telegram_en,
    subject_telegram_ar = EXCLUDED.subject_telegram_ar,
    body_telegram_md_en = EXCLUDED.body_telegram_md_en,
    body_telegram_md_ar = EXCLUDED.body_telegram_md_ar,
    description = EXCLUDED.description,
    is_active = true,
    updated_at = now();

-- 3. Mapping
INSERT INTO public.email_event_mappings
  (event_key, audience, send_to, admin_channel_override, use_db_template, template_id, is_enabled)
SELECT
  'admin-weekly-content-gap',
  'admin',
  'admin',
  'user_choice',
  true,
  t.id,
  true
FROM public.email_templates t
WHERE t.name = 'admin-weekly-content-gap'
ON CONFLICT (event_key, audience) DO UPDATE
SET template_id = EXCLUDED.template_id,
    use_db_template = true,
    is_enabled = true,
    updated_at = now();

-- 4. Cron — Saturday 08:00 Cairo (= 06:00 UTC)
DO $$
DECLARE
  v_existing bigint;
  v_url text := 'https://lrouvlmandrjughswbyw.supabase.co/functions/v1/weekly-content-audit';
  v_token text;
BEGIN
  -- Try fetch existing cron token from vault
  BEGIN
    SELECT decrypted_secret INTO v_token
    FROM vault.decrypted_secrets
    WHERE name = 'CRON_SECRET'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_token := NULL;
  END;

  SELECT jobid INTO v_existing FROM cron.job WHERE jobname = 'weekly-content-audit';
  IF v_existing IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing);
  END IF;

  PERFORM cron.schedule(
    'weekly-content-audit',
    '0 6 * * 6',  -- Saturday 06:00 UTC = 08:00 Cairo
    format(
      $cron$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body := jsonb_build_object('triggered_at', now())
      );
      $cron$,
      v_url,
      COALESCE(v_token, '')
    )
  );
END $$;