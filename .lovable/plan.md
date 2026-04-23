

# Phase 1 — نظام توظيف تفاعلي (الحد الأدنى الفعّال)

تنفيذ 4 ميزات أساسية فقط، مع KPIs قابلة للقياس. باقي الميزات (Messaging، Timeline، Bulk actions) مؤجلة لـ Phase 2 بعد قياس النتائج.

---

## 1. جدولة المقابلات + ICS Calendar Invite

**واجهة بسيطة جداً (4 حقول فقط):**
- التاريخ
- الوقت (بتوقيت القاهرة)
- المدة (15/30/45/60 دقيقة)
- النوع: Online / Onsite / Phone
  - Online → حقل إضافي لـ meeting link
  - Onsite → حقل عنوان

**الإرسال التلقائي:**
- إيميل تأكيد للمتقدم مع `.ics attachment` (يضيف الموعد لتقويمه مباشرة)
- Reminder قبل 24 ساعة
- Reminder قبل 1 ساعة

**ضمانات تقنية حرجة:**
- **Timezone**: كل المواعيد تُخزن UTC، تُعرض بـ Africa/Cairo (متوافق مع memory الموجود `tech-stack/timezone-architecture-cairo`)
- **Idempotency**: كل reminder له `idempotencyKey` فريد بصيغة `interview-{id}-reminder-{24h|1h}` لمنع التكرار
- **Fallback**: لو فشل الإيميل، يُسجَّل في `email_send_log` مع سبب واضح، ويظهر badge أحمر في صفحة المقابلة

**بعد المقابلة:**
- زرار "تسجيل النتيجة" → Pass / Fail / Need another round + ملاحظات (اختياري)

---

## 2. أسباب الرفض الموحدة (Rejection Reasons)

**استبدال "Reject" البسيط بـ Dialog:**
- قائمة `Select` بأسباب جاهزة (Seed data):
  - الخبرة غير كافية
  - التخصص غير مطابق
  - الموقع الجغرافي
  - الراتب المتوقع
  - الاحتفاظ بالـ CV لفرص مستقبلية
  - أخرى (نص حر)
- قالب إيميل تلقائي مهذب يتغير محتواه حسب السبب
- السبب يُحفظ في DB للإحصائيات

**فايدته:**
- ردود متسقة وحرفية
- بيانات قابلة للتحليل (أكثر سبب رفض شائع → فرصة لتحسين الـ Job Description)

---

## 3. تحويل المتقدم لموظف (Hire → Convert)

**عند تغيير الحالة لـ Hired:**
- يفتح Dialog يجمع بيانات إضافية مطلوبة للموظف:
  - تاريخ بداية العمل
  - الراتب الأساسي
  - الدور (Instructor / Reception)
- زرار "إنشاء حساب موظف" → ينادي edge function تعمل:
  - استدعاء `create-user` الموجودة بالاسم/الإيميل/التليفون من الطلب
  - إنشاء profile بالدور المختار
  - ربط `converted_employee_id` في `job_applications`
- إيميل ترحيب للموظف الجديد ببيانات الدخول

**فايدته:**
- صفر data entry يدوي
- صفر أخطاء نقل بيانات
- ربط واضح بين الطلب والموظف

---

## 4. قوالب إيميل محسنة لكل حالة

**4 قوالب جديدة في `email_templates`:**

| القالب | متى يُرسل |
|---|---|
| `job-application-shortlisted` | عند تغيير الحالة لـ Shortlisted |
| `job-interview-scheduled` | عند جدولة مقابلة (مع .ics) |
| `job-interview-reminder` | قبل 24h و 1h من المقابلة |
| `job-application-rejected` | مع تخصيص حسب reason_code |

**كلها بـ branding كوجوبوت + RTL + متغيرات ديناميكية:**
- `{{applicant_name}}`، `{{job_title}}`، `{{interview_date}}`، `{{interview_time_cairo}}`، `{{meeting_link}}`، `{{rejection_reason}}`

---

## 📊 KPIs للقياس بعد أسبوعين من التشغيل

سيتم إضافة بطاقة `RecruitmentMetrics` في `AdminJobs` تعرض:

1. **Time to Hire** (متوسط الوقت من `submitted_at` إلى `hired`)
2. **Interview No-Show Rate** (مقابلات `status='no_show'` ÷ كل المقابلات المجدولة)
3. **Conversion Rate** (متقدمين بحالة `hired` ÷ إجمالي المتقدمين)

تُحسب عبر RPC `get_recruitment_metrics(date_from, date_to)`.

---

## التفاصيل التقنية

### قاعدة البيانات (Migration واحد)

```text
+ job_interviews
  - id uuid PK
  - application_id uuid FK job_applications ON DELETE CASCADE
  - scheduled_at timestamptz NOT NULL  (UTC)
  - duration_minutes int NOT NULL DEFAULT 30
  - mode text CHECK (mode IN ('online','onsite','phone'))
  - meeting_link text
  - location text
  - status text DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','completed','cancelled','no_show'))
  - outcome text CHECK (outcome IN ('pass','fail','another_round') OR NULL)
  - notes text
  - reminder_24h_sent_at timestamptz
  - reminder_1h_sent_at timestamptz
  - created_by uuid FK profiles(user_id)
  - created_at, updated_at

+ job_rejection_reasons (seed table)
  - id uuid PK
  - code text UNIQUE
  - label_en text, label_ar text
  - active bool DEFAULT true
  - sort_order int

+ تعديل job_applications:
  - rejection_reason_code text FK job_rejection_reasons(code)
  - rejection_notes text
  - converted_employee_id uuid FK profiles(user_id)
  - hire_start_date date
  - hire_role text CHECK (hire_role IN ('instructor','reception') OR NULL)
```

**RLS:** Admin/Reception فقط (متوافق مع memory `features/user-roles`).

### Edge Functions جديدة

- **`schedule-job-interview`**: ينشئ سجل مقابلة + يبني .ics + ينادي `send-email`
- **`send-interview-reminders`**: cron كل 15 دقيقة، يفحص مقابلات في النافذتين (24h±15m, 1h±15m) ويرسل reminders. يستخدم `verify_cron_token` RPC fallback (متوافق مع `logic/cron-auth-vault-fallback`)
- **`convert-application-to-employee`**: ينادي `create-user` الموجودة + يربط `converted_employee_id`

### Cron Jobs

```text
send-interview-reminders → */15 * * * *
```

### الواجهة

- `src/components/recruitment/InterviewScheduleDialog.tsx` (4 حقول، ultra-simple)
- `src/components/recruitment/RejectApplicationDialog.tsx` (select + ملاحظات)
- `src/components/recruitment/HireApplicationDialog.tsx` (start_date + role + salary)
- `src/components/recruitment/InterviewOutcomeDialog.tsx` (Pass/Fail/Round + notes)
- `src/components/recruitment/RecruitmentMetricsCard.tsx` (3 KPIs)
- تعديل `ApplicationDetailDialog.tsx`: إضافة قسم **Interviews** يعرض المقابلات المجدولة + زرار "جدولة مقابلة جديدة"
- تعديل `AdminJobDetail.tsx`: استبدال status dropdown البسيط بأزرار actions (Shortlist / Schedule Interview / Hire / Reject) كل واحد يفتح dialog مخصص

### مكتبة .ics

استخدام بناء يدوي بسيط (RFC 5545) داخل edge function، بدون مكتبة خارجية:

```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Kojobot//Recruitment//AR
BEGIN:VEVENT
UID:interview-{id}@kojobot.com
DTSTART:20260425T140000Z
DTEND:20260425T143000Z
SUMMARY:مقابلة وظيفة {job_title}
DESCRIPTION:...
LOCATION:{meeting_link or location}
END:VEVENT
END:VCALENDAR
```

### Seed Data للأسباب

8 أسباب جاهزة (5 محددة + "أخرى" + "احتفاظ للمستقبل" + "غير مطابق للمتطلبات").

---

## ⏱️ التقدير الزمني

- **Migration + seed**: ~30 دقيقة
- **Edge functions (3)**: ~ساعة
- **Dialogs (4) + تعديلات الواجهة**: ~ساعتين
- **قوالب الإيميل (4) + تكامل**: ~ساعة
- **KPIs card + RPC**: ~30 دقيقة

**إجمالي تنفيذ متوقع: نفس اليوم.**

---

## ❌ ما تم تأجيله صراحة لـ Phase 2

- Messaging thread (متقدم ↔ ادمن) — يفتح support system، نأجله لحد ما نقيس الحاجة الفعلية
- Activity Timeline — Nice to have، مش بيحل pain حقيقي حالياً
- Bulk actions — نضيفها لما عدد المتقدمين يبرر ده
- Custom Templates UI — القوالب الجاهزة كافية للبداية

**القرار:** نقيس KPIs لأسبوعين، وبعدها نحدد أولويات Phase 2 بناءً على البيانات.

