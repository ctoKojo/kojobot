INSERT INTO email_event_catalog (event_key, category, display_name_en, display_name_ar, description, supported_audiences, available_variables, preview_data, is_active)
VALUES
  (
    'parent-registration-pending',
    'parent',
    'Parent registration pending approval',
    'تسجيل ولي أمر — في انتظار الموافقة',
    'Sent to a parent immediately after they sign up, confirming the request was received and is awaiting admin approval.',
    ARRAY['parent']::text[],
    '[
      {"key":"parentName","label_en":"Parent name","label_ar":"اسم ولي الأمر","type":"text","sample":"Ahmed Hassan","required":false},
      {"key":"academyName","label_en":"Academy name","label_ar":"اسم الأكاديمية","type":"text","sample":"Kojobot Academy","required":false}
    ]'::jsonb,
    '{"parentName":"Ahmed Hassan","academyName":"Kojobot Academy"}'::jsonb,
    true
  ),
  (
    'parent-account-approved',
    'parent',
    'Parent account approved',
    'تم تفعيل حساب ولي الأمر',
    'Sent to the parent once an admin approves their account, signalling they can now access the portal.',
    ARRAY['parent']::text[],
    '[
      {"key":"parentName","label_en":"Parent name","label_ar":"اسم ولي الأمر","type":"text","sample":"Ahmed Hassan","required":false},
      {"key":"loginUrl","label_en":"Login URL","label_ar":"رابط الدخول","type":"url","sample":"https://kojobot.com/auth","required":false}
    ]'::jsonb,
    '{"parentName":"Ahmed Hassan","loginUrl":"https://kojobot.com/auth"}'::jsonb,
    true
  )
ON CONFLICT (event_key) DO UPDATE SET
  display_name_en = EXCLUDED.display_name_en,
  display_name_ar = EXCLUDED.display_name_ar,
  description = EXCLUDED.description,
  supported_audiences = EXCLUDED.supported_audiences,
  available_variables = EXCLUDED.available_variables,
  preview_data = EXCLUDED.preview_data,
  is_active = true;

INSERT INTO email_event_mappings (event_key, audience, is_enabled, send_to, admin_channel_override, use_db_template)
VALUES
  ('parent-registration-pending', 'parent', true, 'self', 'both', false),
  ('parent-account-approved', 'parent', true, 'self', 'both', false)
ON CONFLICT DO NOTHING;