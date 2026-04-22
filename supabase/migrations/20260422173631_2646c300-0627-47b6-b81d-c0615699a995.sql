-- Add new email events for parent-student linking
INSERT INTO email_event_catalog (event_key, display_name_en, display_name_ar, category, description, supported_audiences, available_variables, preview_data, is_active)
VALUES
(
  'parent-student-linked',
  'Student linked to parent',
  'تم ربط طالب بولي الأمر',
  'parent',
  'Sent to a parent when a student is linked to their account by an admin/reception',
  ARRAY['parent'],
  '[
    {"key":"parentName","type":"text","sample":"Ahmed Hassan","label_en":"Parent name","label_ar":"اسم ولي الأمر","required":false},
    {"key":"studentName","type":"text","sample":"Sara Hassan","label_en":"Student name","label_ar":"اسم الطالب","required":true},
    {"key":"academyName","type":"text","sample":"Kojobot Academy","label_en":"Academy name","label_ar":"اسم الأكاديمية","required":false},
    {"key":"loginUrl","type":"url","sample":"https://kojobot.com/auth","label_en":"Login URL","label_ar":"رابط الدخول","required":false}
  ]'::jsonb,
  '{"parentName":"Ahmed Hassan","studentName":"Sara Hassan","academyName":"Kojobot Academy","loginUrl":"https://kojobot.com/auth"}'::jsonb,
  true
),
(
  'student-linked-to-parent',
  'Parent linked to student',
  'تم ربط ولي أمر بالطالب',
  'student',
  'Sent to a student when a parent is linked to their account',
  ARRAY['student'],
  '[
    {"key":"studentName","type":"text","sample":"Sara Hassan","label_en":"Student name","label_ar":"اسم الطالب","required":false},
    {"key":"parentName","type":"text","sample":"Ahmed Hassan","label_en":"Parent name","label_ar":"اسم ولي الأمر","required":true},
    {"key":"academyName","type":"text","sample":"Kojobot Academy","label_en":"Academy name","label_ar":"اسم الأكاديمية","required":false}
  ]'::jsonb,
  '{"studentName":"Sara Hassan","parentName":"Ahmed Hassan","academyName":"Kojobot Academy"}'::jsonb,
  true
)
ON CONFLICT (event_key) DO UPDATE SET
  display_name_en = EXCLUDED.display_name_en,
  display_name_ar = EXCLUDED.display_name_ar,
  available_variables = EXCLUDED.available_variables,
  preview_data = EXCLUDED.preview_data,
  is_active = true;

-- Create default email templates for the new events
INSERT INTO email_templates (name, audience, subject_en, subject_ar, body_html_en, body_html_ar, is_active)
VALUES
(
  'parent-student-linked',
  'parent',
  '👨‍👧 {{studentName}} has been linked to your account at {{academyName}}',
  '👨‍👧 تم ربط {{studentName}} بحسابك في {{academyName}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;">
    <h2 style="color: #4f46e5; margin-top: 0;">👨‍👧 New student linked to your account</h2>
    <p>Hi {{parentName}},</p>
    <p>We''re happy to let you know that <strong>{{studentName}}</strong> has been linked to your parent account at <strong>{{academyName}}</strong>.</p>
    <p>You can now follow {{studentName}}''s progress, sessions, attendance and payments directly from your parent portal.</p>
    <p style="margin: 28px 0;">
      <a href="{{loginUrl}}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Open parent portal</a>
    </p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="font-size: 13px; color: #6b7280;">— {{academyName}} Team</p>
  </div>',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;" dir="rtl">
    <h2 style="color: #4f46e5; margin-top: 0;">👨‍👧 تم ربط طالب جديد بحسابك</h2>
    <p>أهلاً {{parentName}}،</p>
    <p>يسعدنا إخبارك بأنه تم ربط <strong>{{studentName}}</strong> بحسابك كولي أمر في <strong>{{academyName}}</strong>.</p>
    <p>تقدر دلوقتي تتابع تقدم {{studentName}} وحصصه وحضوره ومدفوعاته من بوابة ولي الأمر مباشرة.</p>
    <p style="margin: 28px 0;">
      <a href="{{loginUrl}}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">افتح بوابة ولي الأمر</a>
    </p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="font-size: 13px; color: #6b7280;">— فريق {{academyName}}</p>
  </div>',
  true
),
(
  'student-linked-to-parent',
  'student',
  '👨‍👧 {{parentName}} has been linked to your account',
  '👨‍👧 تم ربط {{parentName}} بحسابك',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;">
    <h2 style="color: #4f46e5; margin-top: 0;">👨‍👧 A parent has been linked to your account</h2>
    <p>Hi {{studentName}},</p>
    <p>This is a quick note to let you know that <strong>{{parentName}}</strong> has been linked to your account at <strong>{{academyName}}</strong> as a parent/guardian.</p>
    <p>They will be able to follow your sessions, attendance and progress from their parent portal.</p>
    <p>If you think this was done by mistake, please contact the academy administration.</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="font-size: 13px; color: #6b7280;">— {{academyName}} Team</p>
  </div>',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;" dir="rtl">
    <h2 style="color: #4f46e5; margin-top: 0;">👨‍👧 تم ربط ولي أمر بحسابك</h2>
    <p>أهلاً {{studentName}}،</p>
    <p>حبينا نعلمك إنه تم ربط <strong>{{parentName}}</strong> بحسابك في <strong>{{academyName}}</strong> كولي أمر.</p>
    <p>هيقدر يتابع حصصك وحضورك وتقدمك من بوابة ولي الأمر.</p>
    <p>لو تفتكر إن ده حصل بالغلط، من فضلك تواصل مع إدارة الأكاديمية.</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="font-size: 13px; color: #6b7280;">— فريق {{academyName}}</p>
  </div>',
  true
)
ON CONFLICT (name) DO UPDATE SET
  subject_en = EXCLUDED.subject_en,
  subject_ar = EXCLUDED.subject_ar,
  body_html_en = EXCLUDED.body_html_en,
  body_html_ar = EXCLUDED.body_html_ar,
  is_active = true;

-- Create event mappings linking events to templates
INSERT INTO email_event_mappings (event_key, audience, template_id, is_enabled, send_to, use_db_template)
SELECT 'parent-student-linked', 'parent', id, true, 'parent', true
FROM email_templates WHERE name = 'parent-student-linked'
ON CONFLICT (event_key, audience) DO UPDATE SET
  template_id = EXCLUDED.template_id,
  is_enabled = true,
  use_db_template = true;

INSERT INTO email_event_mappings (event_key, audience, template_id, is_enabled, send_to, use_db_template)
SELECT 'student-linked-to-parent', 'student', id, true, 'student', true
FROM email_templates WHERE name = 'student-linked-to-parent'
ON CONFLICT (event_key, audience) DO UPDATE SET
  template_id = EXCLUDED.template_id,
  is_enabled = true,
  use_db_template = true;