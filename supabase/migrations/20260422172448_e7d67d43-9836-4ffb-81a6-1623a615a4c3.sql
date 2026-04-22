-- Create parent-registration-pending template
INSERT INTO public.email_templates (
  name, audience, is_active, description,
  subject_en, subject_ar,
  body_html_en, body_html_ar,
  subject_telegram_en, subject_telegram_ar,
  body_telegram_md_en, body_telegram_md_ar
) VALUES (
  'parent-registration-pending',
  'parent',
  true,
  'Sent to parent immediately after Google sign-up while their account awaits academy approval.',
  'Welcome to {{academyName}} — your account is under review',
  'مرحباً بك في {{academyName}} — حسابك قيد المراجعة',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;">
    <h2 style="color: #4f46e5; margin-top: 0;">Welcome, {{parentName}}!</h2>
    <p>Thank you for registering with <strong>{{academyName}}</strong>.</p>
    <p>Your parent account has been created successfully and is currently <strong>awaiting approval</strong> from the academy administration.</p>
    <p>You will receive another email as soon as your account is approved and you can access the parent portal.</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="font-size: 13px; color: #6b7280;">If you did not register, please ignore this email.</p>
    <p style="font-size: 13px; color: #6b7280;">— {{academyName}} Team</p>
  </div>',
  '<div style="font-family: Tahoma, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937; direction: rtl; text-align: right;">
    <h2 style="color: #4f46e5; margin-top: 0;">مرحباً {{parentName}}!</h2>
    <p>شكراً لتسجيلك في <strong>{{academyName}}</strong>.</p>
    <p>تم إنشاء حسابك كولي أمر بنجاح وهو حالياً <strong>في انتظار موافقة</strong> إدارة الأكاديمية.</p>
    <p>سيصلك إيميل آخر فور اعتماد حسابك ليتسنى لك الدخول إلى بوابة أولياء الأمور.</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="font-size: 13px; color: #6b7280;">إذا لم تكن أنت من قام بالتسجيل، يرجى تجاهل هذه الرسالة.</p>
    <p style="font-size: 13px; color: #6b7280;">— فريق {{academyName}}</p>
  </div>',
  'Welcome to {{academyName}}',
  'مرحباً بك في {{academyName}}',
  '👋 *Welcome, {{parentName}}!*

Thanks for registering with *{{academyName}}*.

Your parent account is currently *awaiting approval* from the academy administration. We''ll notify you as soon as it''s activated.',
  '👋 *مرحباً {{parentName}}!*

شكراً لتسجيلك في *{{academyName}}*.

حسابك كولي أمر *في انتظار موافقة* إدارة الأكاديمية. سنُعلمك فور تفعيله.'
);

-- Create parent-account-approved template
INSERT INTO public.email_templates (
  name, audience, is_active, description,
  subject_en, subject_ar,
  body_html_en, body_html_ar,
  subject_telegram_en, subject_telegram_ar,
  body_telegram_md_en, body_telegram_md_ar
) VALUES (
  'parent-account-approved',
  'parent',
  true,
  'Sent to parent when academy admin/reception approves their account.',
  '✅ Your {{academyName}} parent account is approved',
  '✅ تم اعتماد حسابك كولي أمر في {{academyName}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;">
    <h2 style="color: #059669; margin-top: 0;">🎉 Your account is approved!</h2>
    <p>Hi {{parentName}},</p>
    <p>Great news — your parent account at <strong>{{academyName}}</strong> has been approved by the administration.</p>
    <p>You can now sign in to the parent portal to follow your child''s progress, sessions, attendance and payments.</p>
    <p style="margin: 28px 0;">
      <a href="{{loginUrl}}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Sign in to portal</a>
    </p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="font-size: 13px; color: #6b7280;">— {{academyName}} Team</p>
  </div>',
  '<div style="font-family: Tahoma, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937; direction: rtl; text-align: right;">
    <h2 style="color: #059669; margin-top: 0;">🎉 تم اعتماد حسابك!</h2>
    <p>مرحباً {{parentName}}،</p>
    <p>خبر سار — تم اعتماد حسابك كولي أمر في <strong>{{academyName}}</strong> من قبل الإدارة.</p>
    <p>يمكنك الآن تسجيل الدخول إلى بوابة أولياء الأمور لمتابعة تقدّم ابنك/ابنتك والحصص والحضور والمدفوعات.</p>
    <p style="margin: 28px 0;">
      <a href="{{loginUrl}}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">الدخول إلى البوابة</a>
    </p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="font-size: 13px; color: #6b7280;">— فريق {{academyName}}</p>
  </div>',
  'Account approved ✅',
  'تم اعتماد الحساب ✅',
  '🎉 *Account approved!*

Hi {{parentName}}, your parent account at *{{academyName}}* has been approved.

You can now sign in: {{loginUrl}}',
  '🎉 *تم اعتماد الحساب!*

مرحباً {{parentName}}، تم اعتماد حسابك كولي أمر في *{{academyName}}*.

يمكنك الآن الدخول: {{loginUrl}}'
);

-- Link templates to their event mappings
UPDATE public.email_event_mappings m
SET template_id = t.id, use_db_template = true
FROM public.email_templates t
WHERE m.event_key = t.name
  AND m.event_key IN ('parent-registration-pending', 'parent-account-approved');