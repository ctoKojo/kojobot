-- 1) Add audience column to event_mappings
ALTER TABLE public.email_event_mappings
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'student'
    CHECK (audience IN ('student','parent','instructor','admin','reception','staff'));

CREATE INDEX IF NOT EXISTS idx_event_mappings_audience ON public.email_event_mappings(audience);

-- Drop the unique constraint on event_key (we now allow same event_key with different audience)
ALTER TABLE public.email_event_mappings DROP CONSTRAINT IF EXISTS email_event_mappings_event_key_key;
-- Add composite unique
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_mappings_event_audience
  ON public.email_event_mappings(event_key, audience);

-- 2) Telegram-specific body/subject on templates (optional; falls back to plain-text strip of HTML when null)
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS subject_telegram_en text,
  ADD COLUMN IF NOT EXISTS subject_telegram_ar text,
  ADD COLUMN IF NOT EXISTS body_telegram_md_en text,
  ADD COLUMN IF NOT EXISTS body_telegram_md_ar text,
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'student'
    CHECK (audience IN ('student','parent','instructor','admin','reception','staff'));

CREATE INDEX IF NOT EXISTS idx_email_templates_audience ON public.email_templates(audience);

-- 3) Add a helpful column on the catalog to mark which audiences a given event supports
ALTER TABLE public.email_event_catalog
  ADD COLUMN IF NOT EXISTS supported_audiences text[] NOT NULL DEFAULT ARRAY['student','parent']::text[];

-- Backfill supported_audiences for existing events (student-related events keep student/parent)
UPDATE public.email_event_catalog
   SET supported_audiences = ARRAY['student','parent']::text[]
 WHERE supported_audiences IS NULL OR cardinality(supported_audiences) = 0;

-- Existing instructor-assigned event was wrongly under 'sessions' for students — we will add a NEW set for instructors
-- and keep the old one as-is for the student notification.

-- 4) Insert new INSTRUCTOR events
INSERT INTO public.email_event_catalog (event_key, category, display_name_en, display_name_ar, description, supported_audiences, available_variables)
VALUES
  -- Operations
  ('instructor-group-assigned', 'instructor_ops', 'New group assigned', 'تعيين مجموعة جديدة', 'When admin assigns instructor to a new group',
    ARRAY['instructor']::text[],
    '[{"key":"instructorName","label_en":"Instructor name","label_ar":"اسم المدرب"},{"key":"groupName","label_en":"Group name","label_ar":"اسم المجموعة"},{"key":"scheduleDay","label_en":"Schedule day","label_ar":"يوم الجدول"},{"key":"scheduleTime","label_en":"Schedule time","label_ar":"وقت الجدول"},{"key":"studentsCount","label_en":"Students count","label_ar":"عدد الطلاب"}]'::jsonb),
  ('instructor-session-reminder-1day', 'instructor_ops', 'Session reminder (1 day before)', 'تذكير سيشن (قبل بيوم)', 'Reminder sent to instructor 1 day before session',
    ARRAY['instructor']::text[],
    '[{"key":"instructorName","label_en":"Instructor name","label_ar":"اسم المدرب"},{"key":"groupName","label_en":"Group name","label_ar":"اسم المجموعة"},{"key":"sessionDate","label_en":"Session date","label_ar":"تاريخ السيشن"},{"key":"sessionTime","label_en":"Session time","label_ar":"وقت السيشن"},{"key":"sessionLink","label_en":"Session link","label_ar":"لينك السيشن"}]'::jsonb),
  ('instructor-session-reminder-1h', 'instructor_ops', 'Session reminder (1 hour before)', 'تذكير سيشن (قبل بساعة)', 'Reminder sent to instructor 1 hour before session',
    ARRAY['instructor']::text[],
    '[{"key":"instructorName","label_en":"Instructor name","label_ar":"اسم المدرب"},{"key":"groupName","label_en":"Group name","label_ar":"اسم المجموعة"},{"key":"sessionTime","label_en":"Session time","label_ar":"وقت السيشن"},{"key":"sessionLink","label_en":"Session link","label_ar":"لينك السيشن"}]'::jsonb),
  ('instructor-session-cancelled', 'instructor_ops', 'Session cancelled/postponed', 'إلغاء أو تأجيل سيشن', 'Notify instructor that one of their sessions was cancelled or postponed',
    ARRAY['instructor']::text[],
    '[{"key":"instructorName","label_en":"Instructor name","label_ar":"اسم المدرب"},{"key":"groupName","label_en":"Group name","label_ar":"اسم المجموعة"},{"key":"originalDate","label_en":"Original date","label_ar":"التاريخ الأصلي"},{"key":"reason","label_en":"Reason","label_ar":"السبب"}]'::jsonb),
  ('instructor-schedule-changed', 'instructor_ops', 'Working schedule changed', 'تغيير جدول العمل', 'Instructor weekly schedule changed by admin',
    ARRAY['instructor']::text[],
    '[{"key":"instructorName","label_en":"Instructor name","label_ar":"اسم المدرب"},{"key":"newSchedule","label_en":"New schedule","label_ar":"الجدول الجديد"}]'::jsonb),
  ('instructor-session-rescheduled', 'instructor_ops', 'Session time changed', 'تغيير ميعاد سيشن', 'A specific session time was changed',
    ARRAY['instructor']::text[],
    '[{"key":"instructorName","label_en":"Instructor name","label_ar":"اسم المدرب"},{"key":"groupName","label_en":"Group name","label_ar":"اسم المجموعة"},{"key":"oldDateTime","label_en":"Old date/time","label_ar":"الميعاد القديم"},{"key":"newDateTime","label_en":"New date/time","label_ar":"الميعاد الجديد"}]'::jsonb),
  ('instructor-session-link-changed', 'instructor_ops', 'Session link/room changed', 'تغيير لينك أو قاعة السيشن', 'Online link or physical room changed',
    ARRAY['instructor']::text[],
    '[{"key":"instructorName","label_en":"Instructor name","label_ar":"اسم المدرب"},{"key":"groupName","label_en":"Group name","label_ar":"اسم المجموعة"},{"key":"sessionLink","label_en":"New link","label_ar":"اللينك الجديد"},{"key":"room","label_en":"Room","label_ar":"القاعة"}]'::jsonb),
  ('instructor-session-transferred', 'instructor_ops', 'Session transferred to another instructor', 'نقل سيشن لمدرب آخر', 'Notify both old and new instructor when session is transferred',
    ARRAY['instructor']::text[],
    '[{"key":"instructorName","label_en":"Instructor name","label_ar":"اسم المدرب"},{"key":"otherInstructorName","label_en":"Other instructor","label_ar":"المدرب الآخر"},{"key":"sessionDate","label_en":"Session date","label_ar":"تاريخ السيشن"},{"key":"groupName","label_en":"Group name","label_ar":"اسم المجموعة"}]'::jsonb),
  ('instructor-group-merged-split', 'instructor_ops', 'Group merged/split', 'دمج أو تقسيم مجموعة', 'Notify instructors when groups are merged or split',
    ARRAY['instructor']::text[],
    '[{"key":"instructorName","label_en":"Instructor name","label_ar":"اسم المدرب"},{"key":"action","label_en":"Action (merge/split)","label_ar":"العملية (دمج/تقسيم)"},{"key":"oldGroups","label_en":"Old groups","label_ar":"المجموعات القديمة"},{"key":"newGroups","label_en":"New groups","label_ar":"المجموعات الجديدة"}]'::jsonb),

  -- Attendance & discipline
  ('instructor-attendance-late', 'instructor_attendance', 'Late attendance recording', 'تأخير تسجيل الحضور', 'Instructor recorded attendance late',
    ARRAY['instructor']::text[],
    '[{"key":"instructorName","label_en":"Instructor name","label_ar":"اسم المدرب"},{"key":"groupName","label_en":"Group name","label_ar":"اسم المجموعة"},{"key":"sessionDate","label_en":"Session date","label_ar":"تاريخ السيشن"},{"key":"delayMinutes","label_en":"Delay (minutes)","label_ar":"التأخير (دقائق)"}]'::jsonb),
  ('instructor-attendance-missing', 'instructor_attendance', 'Attendance not recorded', 'عدم تسجيل الحضور', 'No attendance recorded after session ended',
    ARRAY['instructor']::text[],
    '[{"key":"instructorName","label_en":"Instructor name","label_ar":"اسم المدرب"},{"key":"groupName","label_en":"Group name","label_ar":"اسم المجموعة"},{"key":"sessionDate","label_en":"Session date","label_ar":"تاريخ السيشن"}]'::jsonb),
  ('instructor-high-absence-rate', 'instructor_attendance', 'High absence rate in group', 'نسبة غياب عالية في الجروب', 'Group absence rate exceeded threshold',
    ARRAY['instructor']::text[],
    '[{"key":"instructorName","label_en":"Instructor name","label_ar":"اسم المدرب"},{"key":"groupName","label_en":"Group name","label_ar":"اسم المجموعة"},{"key":"absenceRate","label_en":"Absence rate","label_ar":"نسبة الغياب"}]'::jsonb),
  ('instructor-makeup-followup', 'instructor_attendance', 'Makeup attendee needs follow-up', 'طالب حضر makeup ومحتاج متابعة', 'Student attended makeup session - follow up needed',
    ARRAY['instructor']::text[],
    '[{"key":"instructorName","label_en":"Instructor name","label_ar":"اسم المدرب"},{"key":"studentName","label_en":"Student name","label_ar":"اسم الطالب"},{"key":"sessionDate","label_en":"Session date","label_ar":"تاريخ السيشن"}]'::jsonb),

  -- Academic
  ('instructor-assignment-created', 'instructor_academic', 'New assignment created', 'إسناد واجب جديد للجروب', 'Assignment created for instructor''s group',
    ARRAY['instructor']::text[],
    '[{"key":"instructorName","label_en":"Instructor name","label_ar":"اسم المدرب"},{"key":"groupName","label_en":"Group name","label_ar":"اسم المجموعة"},{"key":"assignmentTitle","label_en":"Assignment title","label_ar":"عنوان الواجب"},{"key":"dueDate","label_en":"Due date","label_ar":"تاريخ التسليم"}]'::jsonb),
  ('instructor-quiz-assigned', 'instructor_academic', 'Quiz assigned', 'إسناد كويز', 'Quiz assigned to instructor''s group',
    ARRAY['instructor']::text[],
    '[{"key":"instructorName","label_en":"Instructor name","label_ar":"اسم المدرب"},{"key":"groupName","label_en":"Group name","label_ar":"اسم المجموعة"},{"key":"quizTitle","label_en":"Quiz title","label_ar":"عنوان الكويز"}]'::jsonb),
  ('instructor-deadline-changed', 'instructor_academic', 'Deadline modified', 'تعديل deadline', 'Assignment/quiz deadline modified',
    ARRAY['instructor']::text[],
    '[{"key":"instructorName","label_en":"Instructor name","label_ar":"اسم المدرب"},{"key":"itemTitle","label_en":"Item title","label_ar":"العنوان"},{"key":"oldDeadline","label_en":"Old deadline","label_ar":"الميعاد القديم"},{"key":"newDeadline","label_en":"New deadline","label_ar":"الميعاد الجديد"}]'::jsonb),
  ('instructor-deadline-approaching', 'instructor_academic', 'Deadline approaching without grading', 'اقتراب deadline بدون تصحيح', 'Submissions still ungraded as deadline approaches',
    ARRAY['instructor']::text[],
    '[{"key":"instructorName","label_en":"Instructor name","label_ar":"اسم المدرب"},{"key":"itemTitle","label_en":"Item title","label_ar":"العنوان"},{"key":"ungradedCount","label_en":"Ungraded count","label_ar":"عدد بدون تصحيح"},{"key":"deadline","label_en":"Deadline","label_ar":"الميعاد"}]'::jsonb),
  ('instructor-grading-late', 'instructor_academic', 'Grading delay', 'تأخير في التصحيح', 'Instructor exceeded SLA for grading',
    ARRAY['instructor']::text[],
    '[{"key":"instructorName","label_en":"Instructor name","label_ar":"اسم المدرب"},{"key":"itemTitle","label_en":"Item title","label_ar":"العنوان"},{"key":"daysOverdue","label_en":"Days overdue","label_ar":"أيام التأخير"}]'::jsonb),
  ('instructor-results-not-published', 'instructor_academic', 'Grading done without publishing results', 'انتهاء التصحيح بدون نشر النتائج', 'Grading complete but results not yet published',
    ARRAY['instructor']::text[],
    '[{"key":"instructorName","label_en":"Instructor name","label_ar":"اسم المدرب"},{"key":"itemTitle","label_en":"Item title","label_ar":"العنوان"}]'::jsonb),

  -- Performance & quality
  ('instructor-warning-issued', 'instructor_quality', 'Work warning issued', 'إنذار مخالفة عمل', 'Admin issued a warning to the instructor',
    ARRAY['instructor']::text[],
    '[{"key":"instructorName","label_en":"Instructor name","label_ar":"اسم المدرب"},{"key":"warningType","label_en":"Warning type","label_ar":"نوع الإنذار"},{"key":"reason","label_en":"Reason","label_ar":"السبب"}]'::jsonb),
  ('instructor-low-rating', 'instructor_quality', 'Low rating from students', 'تقييم منخفض من الطلاب', 'Average rating dropped below threshold',
    ARRAY['instructor']::text[],
    '[{"key":"instructorName","label_en":"Instructor name","label_ar":"اسم المدرب"},{"key":"avgRating","label_en":"Average rating","label_ar":"متوسط التقييم"},{"key":"period","label_en":"Period","label_ar":"الفترة"}]'::jsonb),
  ('instructor-parent-complaint', 'instructor_quality', 'Parent complaint', 'شكوى من ولي أمر', 'Parent submitted complaint against instructor',
    ARRAY['instructor']::text[],
    '[{"key":"instructorName","label_en":"Instructor name","label_ar":"اسم المدرب"},{"key":"complaintSummary","label_en":"Complaint summary","label_ar":"ملخص الشكوى"}]'::jsonb),
  ('instructor-admin-note', 'instructor_quality', 'Admin note on session', 'ملاحظة من الادمن على السيشن', 'Admin left a note about a specific session',
    ARRAY['instructor']::text[],
    '[{"key":"instructorName","label_en":"Instructor name","label_ar":"اسم المدرب"},{"key":"sessionDate","label_en":"Session date","label_ar":"تاريخ السيشن"},{"key":"note","label_en":"Note","label_ar":"الملاحظة"}]'::jsonb),
  ('instructor-session-review-required', 'instructor_quality', 'Session review required', 'مراجعة سيشن مطلوبة', 'A session needs instructor review',
    ARRAY['instructor']::text[],
    '[{"key":"instructorName","label_en":"Instructor name","label_ar":"اسم المدرب"},{"key":"sessionDate","label_en":"Session date","label_ar":"تاريخ السيشن"},{"key":"reason","label_en":"Reason","label_ar":"السبب"}]'::jsonb),

  -- Staff (admin/reception)
  ('staff-daily-summary', 'staff_ops', 'Daily ops summary', 'ملخص يومي للعمليات', 'Daily summary of sessions, attendance, payments',
    ARRAY['admin','reception']::text[],
    '[{"key":"date","label_en":"Date","label_ar":"التاريخ"},{"key":"sessionsCount","label_en":"Sessions count","label_ar":"عدد السيشنات"},{"key":"attendanceRate","label_en":"Attendance rate","label_ar":"نسبة الحضور"},{"key":"newPayments","label_en":"New payments","label_ar":"المدفوعات الجديدة"}]'::jsonb),
  ('staff-new-subscription-request', 'staff_ops', 'New subscription request', 'طلب اشتراك جديد', 'New subscription inquiry needs review',
    ARRAY['admin','reception']::text[],
    '[{"key":"studentName","label_en":"Student name","label_ar":"اسم الطالب"},{"key":"plan","label_en":"Plan","label_ar":"الباقة"},{"key":"phone","label_en":"Phone","label_ar":"الهاتف"}]'::jsonb),
  ('staff-balance-mismatch', 'staff_ops', 'Balance mismatch alert', 'مخالفة رصيد', 'Cached vs computed balance mismatch detected',
    ARRAY['admin']::text[],
    '[{"key":"accountType","label_en":"Account type","label_ar":"نوع الحساب"},{"key":"accountId","label_en":"Account ID","label_ar":"رقم الحساب"},{"key":"difference","label_en":"Difference","label_ar":"الفرق"}]'::jsonb),
  ('staff-sla-breach', 'staff_ops', 'SLA breach', 'مخالفة SLA', 'An SLA threshold was breached',
    ARRAY['admin']::text[],
    '[{"key":"breachType","label_en":"Breach type","label_ar":"نوع المخالفة"},{"key":"entityName","label_en":"Entity","label_ar":"العنصر"},{"key":"details","label_en":"Details","label_ar":"التفاصيل"}]'::jsonb)
ON CONFLICT (event_key) DO UPDATE SET
  display_name_en = EXCLUDED.display_name_en,
  display_name_ar = EXCLUDED.display_name_ar,
  description = EXCLUDED.description,
  supported_audiences = EXCLUDED.supported_audiences,
  available_variables = EXCLUDED.available_variables,
  category = EXCLUDED.category;

-- 5) Pre-create event_mappings rows (disabled by default) for each new event so admins see them in UI
INSERT INTO public.email_event_mappings (event_key, audience, is_enabled, send_to, admin_channel_override, use_db_template)
SELECT c.event_key, unnest(c.supported_audiences), false, unnest(c.supported_audiences), 'user_choice', false
FROM public.email_event_catalog c
WHERE c.event_key LIKE 'instructor-%' OR c.event_key LIKE 'staff-%'
ON CONFLICT (event_key, audience) DO NOTHING;

-- 6) Backfill audience for existing mappings based on send_to
-- Existing rows are all student/parent -> set audience to match send_to (or 'student' for 'both'/'user')
UPDATE public.email_event_mappings
   SET audience = CASE
     WHEN send_to = 'parent' THEN 'parent'
     ELSE 'student'
   END
 WHERE audience = 'student' AND event_key NOT LIKE 'instructor-%' AND event_key NOT LIKE 'staff-%';

-- For events that should send to both student AND parent, create the parent row too
INSERT INTO public.email_event_mappings (event_key, audience, is_enabled, send_to, admin_channel_override, use_db_template, template_id)
SELECT m.event_key, 'parent', m.is_enabled, 'parent', m.admin_channel_override, m.use_db_template, m.template_id
FROM public.email_event_mappings m
WHERE m.audience = 'student' AND m.send_to = 'both'
ON CONFLICT (event_key, audience) DO NOTHING;