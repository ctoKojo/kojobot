-- Harden function search_path
CREATE OR REPLACE FUNCTION public.touch_email_template_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Seed event catalog
INSERT INTO public.email_event_catalog (event_key, category, display_name_en, display_name_ar, description, available_variables) VALUES
  ('session-reminder-1h', 'sessions', 'Session reminder (1 hour before)', 'تذكير السيشن (قبل بساعة)', 'Sent 1 hour before each scheduled session.',
    '[{"key":"studentName","label_en":"Student name","label_ar":"اسم الطالب"},{"key":"sessionTitle","label_en":"Session title","label_ar":"عنوان الحصة"},{"key":"sessionDate","label_en":"Session date","label_ar":"تاريخ الحصة"},{"key":"sessionTime","label_en":"Session time","label_ar":"وقت الحصة"},{"key":"groupName","label_en":"Group","label_ar":"المجموعة"},{"key":"recipientName","label_en":"Recipient name","label_ar":"اسم المستلم"}]'::jsonb),
  ('session-reminder-1day', 'sessions', 'Session reminder (1 day before)', 'تذكير السيشن (قبل بيوم)', 'Sent 1 day before each scheduled session.',
    '[{"key":"studentName","label_en":"Student name","label_ar":"اسم الطالب"},{"key":"sessionTitle","label_en":"Session title","label_ar":"عنوان الحصة"},{"key":"sessionDate","label_en":"Session date","label_ar":"تاريخ الحصة"},{"key":"sessionTime","label_en":"Session time","label_ar":"وقت الحصة"},{"key":"groupName","label_en":"Group","label_ar":"المجموعة"}]'::jsonb),
  ('session-rescheduled', 'sessions', 'Session rescheduled', 'تغيير جدول السيشن', 'Sent when an upcoming session date or time changes.',
    '[{"key":"studentName","label_en":"Student","label_ar":"الطالب"},{"key":"sessionTitle","label_en":"Session","label_ar":"الحصة"},{"key":"oldDate","label_en":"Old date/time","label_ar":"الموعد القديم"},{"key":"newDate","label_en":"New date/time","label_ar":"الموعد الجديد"}]'::jsonb),
  ('instructor-assigned', 'sessions', 'Instructor assigned to session', 'تعيين مدرب لسيشن', 'Sent when a new instructor is assigned to a session.',
    '[{"key":"studentName","label_en":"Student","label_ar":"الطالب"},{"key":"instructorName","label_en":"Instructor","label_ar":"المدرب"},{"key":"sessionTitle","label_en":"Session","label_ar":"الحصة"},{"key":"sessionDate","label_en":"Date","label_ar":"التاريخ"}]'::jsonb),
  ('session-evaluation-request', 'sessions', 'Post-session evaluation request', 'طلب تقييم سيشن', 'Sent after a session asking the student to rate it.',
    '[{"key":"studentName","label_en":"Student","label_ar":"الطالب"},{"key":"sessionTitle","label_en":"Session","label_ar":"الحصة"},{"key":"evaluationLink","label_en":"Evaluation link","label_ar":"رابط التقييم"}]'::jsonb),

  ('attendance-absent', 'attendance', 'Absence alert', 'تنبيه غياب', 'Sent when a student is marked absent from a session.',
    '[{"key":"studentName","label_en":"Student","label_ar":"الطالب"},{"key":"sessionTitle","label_en":"Session","label_ar":"الحصة"},{"key":"sessionDate","label_en":"Date","label_ar":"التاريخ"}]'::jsonb),
  ('attendance-late', 'attendance', 'Late arrival alert', 'تنبيه تأخير', 'Sent when a student is marked late.',
    '[{"key":"studentName","label_en":"Student","label_ar":"الطالب"},{"key":"sessionTitle","label_en":"Session","label_ar":"الحصة"},{"key":"sessionDate","label_en":"Date","label_ar":"التاريخ"}]'::jsonb),

  ('payment-due', 'finance', 'Payment due reminder', 'تذكير قسط مستحق', 'Sent before an installment due date.',
    '[{"key":"recipientName","label_en":"Recipient","label_ar":"المستلم"},{"key":"studentName","label_en":"Student","label_ar":"الطالب"},{"key":"amount","label_en":"Amount","label_ar":"المبلغ"},{"key":"currency","label_en":"Currency","label_ar":"العملة"},{"key":"dueDate","label_en":"Due date","label_ar":"تاريخ الاستحقاق"}]'::jsonb),
  ('payment-success', 'finance', 'Payment received confirmation', 'تأكيد استلام دفعة', 'Sent after a successful payment (cash or online).',
    '[{"key":"recipientName","label_en":"Recipient","label_ar":"المستلم"},{"key":"studentName","label_en":"Student","label_ar":"الطالب"},{"key":"amount","label_en":"Amount","label_ar":"المبلغ"},{"key":"currency","label_en":"Currency","label_ar":"العملة"},{"key":"paidAt","label_en":"Paid at","label_ar":"تاريخ الدفع"},{"key":"method","label_en":"Method","label_ar":"الطريقة"}]'::jsonb),
  ('payment-failed', 'finance', 'Payment failed', 'فشل عملية الدفع', 'Sent when an online payment attempt fails.',
    '[{"key":"recipientName","label_en":"Recipient","label_ar":"المستلم"},{"key":"studentName","label_en":"Student","label_ar":"الطالب"},{"key":"amount","label_en":"Amount","label_ar":"المبلغ"},{"key":"reason","label_en":"Reason","label_ar":"السبب"}]'::jsonb),
  ('subscription-renewal-before', 'finance', 'Subscription renewal (before expiry)', 'تجديد الاشتراك (قبل الانتهاء)', 'Sent N days before subscription expires.',
    '[{"key":"recipientName","label_en":"Recipient","label_ar":"المستلم"},{"key":"studentName","label_en":"Student","label_ar":"الطالب"},{"key":"expiresOn","label_en":"Expires on","label_ar":"تاريخ الانتهاء"},{"key":"renewLink","label_en":"Renew link","label_ar":"رابط التجديد"}]'::jsonb),
  ('subscription-renewal-after', 'finance', 'Subscription renewal (after expiry)', 'تجديد الاشتراك (بعد الانتهاء)', 'Sent after a subscription expires without renewal.',
    '[{"key":"recipientName","label_en":"Recipient","label_ar":"المستلم"},{"key":"studentName","label_en":"Student","label_ar":"الطالب"},{"key":"expiredOn","label_en":"Expired on","label_ar":"تاريخ الانتهاء"},{"key":"renewLink","label_en":"Renew link","label_ar":"رابط التجديد"}]'::jsonb),
  ('subscription-updated', 'finance', 'Subscription updated', 'تحديث الاشتراك', 'Sent when a subscription plan changes (renewal, upgrade, swap).',
    '[{"key":"recipientName","label_en":"Recipient","label_ar":"المستلم"},{"key":"studentName","label_en":"Student","label_ar":"الطالب"},{"key":"oldPlan","label_en":"Old plan","label_ar":"الباقة السابقة"},{"key":"newPlan","label_en":"New plan","label_ar":"الباقة الجديدة"}]'::jsonb),

  ('level-upgraded', 'academic', 'Level upgraded', 'ترقية مستوى', 'Sent when a student moves to the next level.',
    '[{"key":"studentName","label_en":"Student","label_ar":"الطالب"},{"key":"fromLevel","label_en":"From level","label_ar":"من مستوى"},{"key":"toLevel","label_en":"To level","label_ar":"إلى مستوى"}]'::jsonb),
  ('certificate-issued', 'academic', 'Certificate issued', 'إصدار شهادة', 'Sent when a course certificate is generated.',
    '[{"key":"studentName","label_en":"Student","label_ar":"الطالب"},{"key":"courseName","label_en":"Course","label_ar":"الكورس"},{"key":"certificateLink","label_en":"Certificate link","label_ar":"رابط الشهادة"}]'::jsonb),
  ('final-exam-result', 'academic', 'Final exam result released', 'نتيجة الامتحان النهائي', 'Sent when a final exam result is published.',
    '[{"key":"studentName","label_en":"Student","label_ar":"الطالب"},{"key":"levelName","label_en":"Level","label_ar":"المستوى"},{"key":"score","label_en":"Score","label_ar":"الدرجة"},{"key":"status","label_en":"Pass/Fail","label_ar":"الحالة"}]'::jsonb),
  ('academic-warning', 'academic', 'Academic warning issued', 'إنذار أكاديمي', 'Sent when a student receives an academic warning.',
    '[{"key":"studentName","label_en":"Student","label_ar":"الطالب"},{"key":"warningType","label_en":"Warning type","label_ar":"نوع الإنذار"},{"key":"reason","label_en":"Reason","label_ar":"السبب"}]'::jsonb),

  ('student-welcome', 'lifecycle', 'Welcome new student', 'ترحيب بطالب جديد', 'Sent when a student account is first created.',
    '[{"key":"studentName","label_en":"Student","label_ar":"الطالب"},{"key":"loginEmail","label_en":"Login email","label_ar":"بريد الدخول"}]'::jsonb),
  ('enrollment-confirmed', 'lifecycle', 'Enrollment confirmed', 'تأكيد التسجيل في كورس', 'Sent when a student is officially enrolled in a course.',
    '[{"key":"studentName","label_en":"Student","label_ar":"الطالب"},{"key":"courseName","label_en":"Course","label_ar":"الكورس"},{"key":"startDate","label_en":"Start date","label_ar":"تاريخ البدء"}]'::jsonb),
  ('account-suspended', 'lifecycle', 'Account suspended', 'تعليق الحساب', 'Sent when an account is suspended.',
    '[{"key":"recipientName","label_en":"Recipient","label_ar":"المستلم"},{"key":"reason","label_en":"Reason","label_ar":"السبب"}]'::jsonb),
  ('account-reactivated', 'lifecycle', 'Account reactivated', 'إعادة تفعيل الحساب', 'Sent after a suspended account is reactivated.',
    '[{"key":"recipientName","label_en":"Recipient","label_ar":"المستلم"}]'::jsonb),
  ('leave-decision', 'lifecycle', 'Leave request decision', 'قرار طلب إجازة', 'Sent when a leave request is approved or rejected.',
    '[{"key":"studentName","label_en":"Student","label_ar":"الطالب"},{"key":"decision","label_en":"Decision","label_ar":"القرار"},{"key":"fromDate","label_en":"From","label_ar":"من"},{"key":"toDate","label_en":"To","label_ar":"إلى"},{"key":"adminNote","label_en":"Admin note","label_ar":"ملاحظة الإدارة"}]'::jsonb),
  ('makeup-created', 'lifecycle', 'Makeup session created', 'إنشاء سيشن تعويضي', 'Sent when a makeup session is generated.',
    '[{"key":"studentName","label_en":"Student","label_ar":"الطالب"},{"key":"originalSession","label_en":"Original session","label_ar":"السيشن الأصلية"},{"key":"makeupDate","label_en":"Makeup date","label_ar":"تاريخ التعويضي"}]'::jsonb),
  ('makeup-confirmed', 'lifecycle', 'Makeup session confirmed', 'تأكيد السيشن التعويضي', 'Sent after a parent confirms a makeup session.',
    '[{"key":"studentName","label_en":"Student","label_ar":"الطالب"},{"key":"makeupDate","label_en":"Makeup date","label_ar":"تاريخ التعويضي"},{"key":"sessionTime","label_en":"Time","label_ar":"الوقت"}]'::jsonb)
ON CONFLICT (event_key) DO NOTHING;