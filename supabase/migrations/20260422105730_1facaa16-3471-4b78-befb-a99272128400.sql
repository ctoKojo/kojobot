WITH admin_uid AS (
  SELECT user_id FROM public.user_roles WHERE role = 'admin' ORDER BY user_id LIMIT 1
),
events AS (
  SELECT * FROM (VALUES
    ('instructor-group-assigned', 'instructor',
      'New group assigned: {{groupName}}', 'تم تعيينك لمجموعة جديدة: {{groupName}}',
      'New group: {{groupName}}', 'مجموعة جديدة: {{groupName}}',
      '<h2>New group assigned</h2><p>Hi {{instructorName}},</p><p>You have been assigned to <b>{{groupName}}</b>.</p><p><b>Schedule:</b> {{scheduleDay}} at {{scheduleTime}}<br/><b>Students:</b> {{studentsCount}}</p>',
      '<h2>تم تعيينك لمجموعة جديدة</h2><p>أهلاً {{instructorName}}،</p><p>تم تعيينك للمجموعة <b>{{groupName}}</b>.</p><p><b>الجدول:</b> {{scheduleDay}} الساعة {{scheduleTime}}<br/><b>عدد الطلاب:</b> {{studentsCount}}</p>',
      '<b>👨‍🏫 مجموعة جديدة</b>'||E'\n\n'||'تم تعيينك لمجموعة <b>{{groupName}}</b>.'||E'\n\n'||'📅 {{scheduleDay}} • ⏰ {{scheduleTime}}'||E'\n'||'👥 {{studentsCount}} طالب'),
    ('instructor-session-reminder-1day', 'instructor',
      'Tomorrow: session for {{groupName}}', 'تذكير: سيشن غداً لـ {{groupName}}',
      'Session tomorrow', 'سيشن غداً',
      '<h2>Session tomorrow</h2><p>Hi {{instructorName}}, you have a session for <b>{{groupName}}</b> on {{sessionDate}} at {{sessionTime}}.</p><p>Link: {{sessionLink}}</p>',
      '<h2>سيشن غداً</h2><p>أهلاً {{instructorName}}، عندك سيشن لـ <b>{{groupName}}</b> يوم {{sessionDate}} الساعة {{sessionTime}}.</p><p>الرابط: {{sessionLink}}</p>',
      '<b>⏰ سيشن غداً</b>'||E'\n\n'||'<b>{{groupName}}</b>'||E'\n'||'📅 {{sessionDate}} • ⏰ {{sessionTime}}'),
    ('instructor-session-reminder-1h', 'instructor',
      'In 1 hour: session for {{groupName}}', 'بعد ساعة: سيشن لـ {{groupName}}',
      'Session in 1 hour', 'سيشن بعد ساعة',
      '<h2>Session in 1 hour</h2><p>Hi {{instructorName}}, your session for <b>{{groupName}}</b> starts at {{sessionTime}}.</p>',
      '<h2>سيشن بعد ساعة</h2><p>أهلاً {{instructorName}}، السيشن بتاع <b>{{groupName}}</b> هيبدأ الساعة {{sessionTime}}.</p>',
      '<b>🔔 بعد ساعة</b>'||E'\n\n'||'<b>{{groupName}}</b>'||E'\n'||'⏰ {{sessionTime}}'),
    ('instructor-session-cancelled', 'instructor',
      'Session cancelled: {{groupName}}', 'تم إلغاء/تأجيل سيشن: {{groupName}}',
      'Session cancelled', 'سيشن ملغى',
      '<h2>Session cancelled</h2><p>The session for <b>{{groupName}}</b> on {{sessionDate}} has been {{action}}. {{reason}}</p>',
      '<h2>سيشن ملغى</h2><p>تم {{action}} سيشن <b>{{groupName}}</b> يوم {{sessionDate}}. {{reason}}</p>',
      '<b>⚠️ سيشن ملغى/مؤجل</b>'||E'\n\n'||'<b>{{groupName}}</b> — {{sessionDate}}'||E'\n'||'{{reason}}'),
    ('instructor-warning-issued', 'instructor',
      'Warning: {{warningTitle}}', 'إنذار: {{warningTitle}}',
      'Warning issued', 'إنذار',
      '<h2>Work warning</h2><p>Hi {{instructorName}}, an admin has issued a warning:</p><p><b>{{warningTitle}}</b></p><p>{{warningDetails}}</p>',
      '<h2>إنذار عمل</h2><p>أهلاً {{instructorName}}، صدر إنذار من الإدارة:</p><p><b>{{warningTitle}}</b></p><p>{{warningDetails}}</p>',
      '<b>⚠️ إنذار عمل</b>'||E'\n\n'||'<b>{{warningTitle}}</b>'||E'\n'||'{{warningDetails}}'),
    ('instructor-schedule-changed', 'instructor',
      'Schedule changed for {{groupName}}', 'تغيير في جدول {{groupName}}',
      'Schedule update', 'تحديث جدول',
      '<h2>Schedule update</h2><p><b>{{groupName}}</b>: {{oldSlot}} → {{newSlot}}</p>',
      '<h2>تحديث الجدول</h2><p><b>{{groupName}}</b>: {{oldSlot}} ← {{newSlot}}</p>',
      '<b>📅 تحديث الجدول</b>'||E'\n\n'||'{{groupName}}'||E'\n'||'{{oldSlot}} ← {{newSlot}}'),
    ('instructor-attendance-late', 'instructor',
      'Late attendance for {{groupName}}', 'تأخر تسجيل الحضور لـ {{groupName}}',
      'Attendance reminder', 'تذكير حضور',
      '<h2>Attendance reminder</h2><p>You have not recorded attendance for <b>{{groupName}}</b> ({{sessionDate}}) yet. Please complete it.</p>',
      '<h2>تذكير حضور</h2><p>لسه ما سجلتش حضور <b>{{groupName}}</b> ({{sessionDate}}). سجل دلوقتي.</p>',
      '<b>📋 تذكير</b>'||E'\n\n'||'سجّل حضور <b>{{groupName}}</b> ({{sessionDate}}).'),
    ('instructor-attendance-missing', 'instructor',
      'Attendance missing: {{groupName}}', 'حضور مفقود: {{groupName}}',
      'Attendance overdue', 'حضور متأخر',
      '<h2>Attendance overdue</h2><p>Attendance for <b>{{groupName}}</b> ({{sessionDate}}) is overdue. Please record it now to avoid an SLA warning.</p>',
      '<h2>حضور متأخر</h2><p>الحضور لـ <b>{{groupName}}</b> ({{sessionDate}}) متأخر. سجله الآن لتجنب الإنذار.</p>',
      '<b>🚨 حضور متأخر</b>'||E'\n\n'||'<b>{{groupName}}</b> — {{sessionDate}}'),
    ('instructor-high-absence', 'instructor',
      'High absence rate in {{groupName}}', 'نسبة غياب عالية في {{groupName}}',
      'High absence', 'غياب مرتفع',
      '<h2>High absence rate</h2><p>{{groupName}}: {{absenceRate}}% absent in the last {{period}}.</p>',
      '<h2>غياب عالٍ</h2><p>{{groupName}}: نسبة غياب {{absenceRate}}% خلال {{period}}.</p>',
      '<b>📉 غياب عالٍ</b>'||E'\n\n'||'{{groupName}}: {{absenceRate}}%'),
    ('instructor-grading-overdue', 'instructor',
      'Grading overdue: {{quizTitle}}', 'تأخر تصحيح: {{quizTitle}}',
      'Grading overdue', 'تصحيح متأخر',
      '<h2>Grading overdue</h2><p>{{pendingCount}} submissions for <b>{{quizTitle}}</b> are awaiting grading. SLA breached by {{breachHours}}h.</p>',
      '<h2>تصحيح متأخر</h2><p>{{pendingCount}} تسليم لـ <b>{{quizTitle}}</b> منتظر التصحيح. تجاوز SLA بـ {{breachHours}} ساعة.</p>',
      '<b>📝 تصحيح متأخر</b>'||E'\n\n'||'{{quizTitle}}: {{pendingCount}} تسليم'),
    ('instructor-deadline-near', 'instructor',
      'Deadline approaching: {{title}}', 'اقتراب deadline: {{title}}',
      'Deadline soon', 'موعد قريب',
      '<h2>Deadline approaching</h2><p><b>{{title}}</b> is due in {{hoursLeft}}h with {{ungradedCount}} ungraded submissions.</p>',
      '<h2>اقتراب الموعد</h2><p><b>{{title}}</b> الـdeadline بعد {{hoursLeft}} ساعة و فيه {{ungradedCount}} تسليم غير مصحح.</p>',
      '<b>⏰ Deadline قريب</b>'||E'\n\n'||'{{title}} — بعد {{hoursLeft}}h'),
    ('instructor-low-rating', 'instructor',
      'Low rating from students', 'تقييم منخفض من الطلاب',
      'Low rating', 'تقييم منخفض',
      '<h2>Low student rating</h2><p>You received an average rating of {{rating}}/5 in {{groupName}} ({{sessionDate}}).</p>',
      '<h2>تقييم طلاب منخفض</h2><p>متوسط تقييمك {{rating}}/5 في {{groupName}} ({{sessionDate}}).</p>',
      '<b>⭐ تقييم منخفض</b>'||E'\n\n'||'{{rating}}/5 — {{groupName}}'),
    ('instructor-admin-feedback', 'instructor',
      'Admin feedback on session', 'ملاحظة من الإدارة على السيشن',
      'Admin feedback', 'ملاحظة إدارة',
      '<h2>Admin feedback</h2><p>An admin left feedback on your session for <b>{{groupName}}</b>:</p><blockquote>{{feedback}}</blockquote>',
      '<h2>ملاحظة من الإدارة</h2><p>صدرت ملاحظة على سيشن <b>{{groupName}}</b>:</p><blockquote>{{feedback}}</blockquote>',
      '<b>💬 ملاحظة الإدارة</b>'||E'\n\n'||'{{groupName}}:'||E'\n'||'<i>{{feedback}}</i>'),
    ('staff-daily-summary', 'admin',
      'Daily summary — {{date}}', 'الملخص اليومي — {{date}}',
      'Daily summary', 'ملخص يومي',
      '<h2>Daily summary</h2><p>Sessions: {{sessionsCount}} • Attendance: {{attendanceRate}}% • New payments: {{paymentsTotal}} EGP</p>',
      '<h2>الملخص اليومي</h2><p>السيشنات: {{sessionsCount}} • الحضور: {{attendanceRate}}% • المدفوعات: {{paymentsTotal}} ج.م</p>',
      '<b>📊 ملخص يومي</b>'||E'\n\n'||'سيشنات: {{sessionsCount}}'||E'\n'||'حضور: {{attendanceRate}}%'||E'\n'||'مدفوعات: {{paymentsTotal}} ج.م'),
    ('staff-new-subscription-request', 'admin',
      'New subscription request', 'طلب اشتراك جديد',
      'New request', 'طلب جديد',
      '<h2>New subscription request</h2><p>{{studentName}} requested {{planName}}. Review in admin panel.</p>',
      '<h2>طلب اشتراك جديد</h2><p>{{studentName}} طلب باقة {{planName}}. للمراجعة من لوحة الإدارة.</p>',
      '<b>📥 طلب اشتراك</b>'||E'\n\n'||'{{studentName}} → {{planName}}'),
    ('staff-balance-mismatch', 'admin',
      'Balance mismatch detected', 'عدم تطابق رصيد',
      'Balance alert', 'تنبيه رصيد',
      '<h2>Balance mismatch</h2><p>Account {{accountId}}: cached={{cached}} computed={{computed}} diff={{diff}}.</p>',
      '<h2>عدم تطابق الرصيد</h2><p>حساب {{accountId}}: مخزن={{cached}} محسوب={{computed}} الفرق={{diff}}.</p>',
      '<b>🚨 تنبيه رصيد</b>'||E'\n\n'||'الحساب: {{accountId}}'||E'\n'||'الفرق: {{diff}}')
  ) AS t(event_key, audience, subject_en, subject_ar, subj_tg_en, subj_tg_ar, body_html_en, body_html_ar, body_tg_ar)
)
INSERT INTO public.email_templates (
  name, audience, subject_en, subject_ar,
  subject_telegram_en, subject_telegram_ar,
  body_html_en, body_html_ar, body_telegram_md_ar, body_telegram_md_en,
  is_active, created_by, description
)
SELECT
  'default-' || e.event_key,
  e.audience,
  e.subject_en, e.subject_ar,
  e.subj_tg_en, e.subj_tg_ar,
  e.body_html_en, e.body_html_ar,
  e.body_tg_ar, e.body_tg_ar,
  true,
  (SELECT user_id FROM admin_uid),
  'Default template for ' || e.event_key
FROM events e
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates t
  WHERE t.name = 'default-' || e.event_key AND t.audience = e.audience
);

-- Wire mappings: use 'user_choice' as default channel override
INSERT INTO public.email_event_mappings (event_key, audience, template_id, use_db_template, is_enabled, send_to, admin_channel_override)
SELECT
  c.event_key,
  unnest(c.supported_audiences) AS aud,
  t.id,
  true,
  true,
  CASE
    WHEN c.event_key LIKE 'staff-%' THEN 'admin'
    WHEN c.event_key LIKE 'instructor-%' THEN 'instructor'
    ELSE 'student'
  END,
  'user_choice'
FROM public.email_event_catalog c
JOIN public.email_templates t
  ON t.name = 'default-' || c.event_key
 AND t.audience = ANY(c.supported_audiences)
WHERE c.event_key LIKE 'instructor-%' OR c.event_key LIKE 'staff-%'
ON CONFLICT (event_key, audience) DO NOTHING;
