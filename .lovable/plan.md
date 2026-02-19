
# نظام ادارة الاداء الشامل - خطة التنفيذ النهائية Production-Ready

---

## نظرة عامة

تحويل نظام الانذارات من نموذج تفاعلي (Warning → Deduction) الى نظام ادارة جودة تشغيل مؤسسي يشمل: وقاية استباقية (SLA Monitoring)، خصومات تصاعدية بنافذة 30 يوم، تقييم اداء (Quality Score)، مكافآت بموافقة الادمن، لوحة تحكم تنفيذية، ونظام مراقبة ذاتي. بالاضافة الى الغاء انشاء الواجبات من صفحة الواجبات.

---

## المرحلة 1: تغييرات قاعدة البيانات (Migration)

### 1.1 تعديل جدول `instructor_warnings`

اضافة 3 اعمدة:
- `reference_id` (UUID, nullable) - ربط الانذار بكيان محدد
- `reference_type` (TEXT, nullable) - نوع الكيان: `conversation` / `submission` / `session`
- `severity` (TEXT, default `minor`) - مستوى الخطورة: `minor` / `major` / `critical`

مع unique partial index:
```text
CREATE UNIQUE INDEX idx_warnings_no_duplicate
  ON instructor_warnings (instructor_id, warning_type, reference_id)
  WHERE reference_id IS NOT NULL AND is_active = true;
```

### 1.2 تعديل جدول `warning_deduction_rules`

اضافة 3 اعمدة:
- `severity` (TEXT, default `minor`)
- `action` (TEXT, default `deduction`) - يدعم `deduction` / `suspension_recommendation`
- `version` (INTEGER, default 1) - لتتبع اي نسخة من القاعدة طُبقت على اي خصم

### 1.3 انشاء جدول `performance_events` (Audit Log)

```text
performance_events
  id UUID PK
  instructor_id UUID NOT NULL
  event_type TEXT NOT NULL CHECK (event_type IN (
    'reminder_sent', 'warning_created', 'deduction_pending',
    'deduction_applied', 'bonus_recommended', 'bonus_approved',
    'suspension_recommended', 'override_applied', 'escalation_event'
  ))
  reference_id UUID
  reference_type TEXT
  details JSONB DEFAULT '{}'
  is_archived BOOLEAN DEFAULT false
  created_at TIMESTAMPTZ DEFAULT now()
```

- `is_archived` للـ soft delete بدل الحذف الفعلي (يحافظ على audit trail كامل)
- CHECK constraint على `event_type` لمنع data pollution

### 1.4 انشاء جدول `instructor_performance_metrics`

```text
instructor_performance_metrics
  id UUID PK
  instructor_id UUID NOT NULL
  month DATE NOT NULL
  avg_reply_time_hours NUMERIC DEFAULT 0
  avg_grading_time_hours NUMERIC DEFAULT 0
  total_warnings INTEGER DEFAULT 0
  total_reminders INTEGER DEFAULT 0
  total_students INTEGER DEFAULT 0
  total_groups INTEGER DEFAULT 0
  quality_score NUMERIC DEFAULT 100
  created_at TIMESTAMPTZ DEFAULT now()
  updated_at TIMESTAMPTZ DEFAULT now()
  UNIQUE(instructor_id, month)
```

### 1.5 انشاء جدول `system_health_metrics` (مراقبة النظام نفسه)

```text
system_health_metrics
  id UUID PK
  date DATE NOT NULL UNIQUE
  total_reminders INTEGER DEFAULT 0
  total_warnings INTEGER DEFAULT 0
  total_deductions INTEGER DEFAULT 0
  avg_execution_time_ms INTEGER DEFAULT 0
  errors_count INTEGER DEFAULT 0
  created_at TIMESTAMPTZ DEFAULT now()
```

يُستخدم لمراقبة: هل النظام اصبح عدواني اكثر من اللازم؟ هل هناك انفجار warnings؟

### 1.6 دالة `compute_quality_score()`

```text
CREATE FUNCTION compute_quality_score(
  p_warnings INT, p_reminders INT,
  p_avg_reply NUMERIC, p_avg_grading NUMERIC,
  p_total_students INT
) RETURNS NUMERIC
```

المعادلة مع Workload Weighting:
1. حساب `penalty_multiplier = 1 - LEAST(p_total_students / 50.0, 0.3)` - تخفيف العقوبة للمدربين ذوي الحمل العالي
2. `base_penalty = (warnings * 5) + (reminders * 1) + LEAST(avg_reply/12, 20) + LEAST(avg_grading/24, 20)`
3. `adjusted_penalty = base_penalty * penalty_multiplier`
4. `score = GREATEST(20, 100 - adjusted_penalty)` - soft floor عند 20

### 1.7 تعديل trigger `auto_warning_deduction`

التعديلات الجوهرية:
1. **Rolling window 30 يوم**: `WHERE created_at >= now() - interval '30 days'` بدل عدد اجمالي
2. **دعم severity**: مطابقة القواعد تشمل severity
3. **Deduction Pending بدل تنفيذ فوري**: الـ trigger يسجل `deduction_pending` في `performance_events` بدل تطبيق الخصم مباشرة - Edge Function منفصلة تعالج الخصومات دوريا (يمنع race conditions + double deduction + deadlocks)
4. **تسجيل `rule_version`** في details للتتبع القانوني
5. **Suspension recommendation**: اذا `action = 'suspension_recommendation'` يرسل اشعار للادمن مع snapshot (score, workload, warnings count) في details

### 1.8 قواعد خصم تصاعدية افتراضية

| النوع | العدد (30 يوم) | المبلغ | Severity | الاجراء |
|---|---|---|---|---|
| no_reply | 2 | 100 | minor | deduction |
| no_reply | 4 | 300 | major | deduction |
| no_reply | 6 | 500 | critical | suspension_recommendation |
| late_grading | 2 | 100 | minor | deduction |
| late_grading | 4 | 300 | major | deduction |
| late_grading | 6 | 500 | critical | suspension_recommendation |

### 1.9 Performance Indexes

```text
CREATE INDEX idx_messages_conv_created ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_submissions_pending ON assignment_submissions(status, submitted_at)
  WHERE status = 'submitted';
CREATE INDEX idx_warnings_rolling ON instructor_warnings(instructor_id, warning_type, created_at)
  WHERE is_active = true;
CREATE INDEX idx_perf_events_instructor ON performance_events(instructor_id, created_at DESC)
  WHERE is_archived = false;
```

### 1.10 RLS Policies

- `instructor_performance_metrics`: Admin = ALL، المدرب = SELECT own
- `performance_events`: Admin = SELECT ALL، المدرب = SELECT own (WHERE is_archived = false)
- `system_health_metrics`: Admin = ALL
- لا يتم تفعيل Realtime على `performance_events` او `system_health_metrics`
- تفعيل Realtime على `instructor_performance_metrics` فقط

---

## المرحلة 2: تطوير Compliance Monitor

### تعديل `supabase/functions/compliance-monitor/index.ts`

البنية المنطقية الجديدة مع فصل واضح + Circuit Breaker:

```text
[Existing] Section 1-4: Quiz / Attendance / Assignment / Student Deadlines
[New] Module A - SLA Monitoring Engine
  Section 5: Message SLA (reminders + warnings)
  Section 6: Grading SLA (reminders + warnings)
[New] Module B - Metrics Engine
  Section 7: Calculate & update performance metrics
[New] Module C - Incentive Engine
  Section 8: Bonus recommendations
[New] Module D - System Health
  Section 9: Record system_health_metrics
```

كل module يعمل داخل try/catch مستقل - لو فشل واحد لا يوقف الباقي.

#### Circuit Breaker

قبل كل module: فحص الوقت المنقضي. اذا تجاوز 80% من timeout (مثلا 24 ثانية من 30):
- ايقاف بقية المدربين
- تسجيل `circuit_breaker_triggered` في logs
- يمنع crash شامل

#### Module A - Section 5: Message SLA

1. حساب حمل كل مدرب **مرة واحدة في Map** (عدد الطلاب) لتحديد Dynamic SLA:
   - اقل من 20 طالب: SLA = 48 ساعة
   - 20-30 طالب: SLA = 72 ساعة
   - اكثر من 30: SLA = 96 ساعة
2. جلب المحادثات بين طلاب ومدربين عبر `conversation_participants` + `user_roles`
3. لكل محادثة، فحص آخر رسالة (باستخدام index):
   - **Prevent Reminder Spam**: قبل ارسال reminder، تحقق من `performance_events WHERE event_type='reminder_sent' AND reference_id=conversation_id AND created_at >= now()-12h` - لو موجود، skip
   - اذا من طالب و >= نصف SLA بدون رد: **تذكير** (notification فقط) + log `reminder_sent`
   - اذا >= SLA كامل: **انذار** `no_reply` مع severity:
     - SLA الى SLA+24h: `minor`
     - SLA+24h الى SLA+72h: `major`
     - اكثر: `critical`
   - **Cap Critical Escalation**: اذا يوجد warning critical active لنفس النوع خلال 30 يوم، لا يتم انشاء critical آخر - فقط تسجيل `escalation_event`
   - **Freeze SLA**: اذا المدرب رد (آخر رسالة في المحادثة من المدرب)، skip المحادثة بالكامل
4. Deduplication: `SELECT WHERE reference_id = conversation_id AND warning_type = 'no_reply' AND is_active = true` قبل INSERT

#### Module A - Section 6: Grading SLA

1. نفس Dynamic SLA حسب حمل المدرب (محسوب مسبقا في Map)
2. جلب `assignment_submissions` بحالة `submitted` (باستخدام partial index)
3. **Prevent Reminder Spam**: نفس منطق Section 5
4. >= نصف SLA: تذكير + log
5. >= SLA كامل: انذار `late_grading` مع severity + Cap Critical
6. Deduplication عبر `reference_id = submission_id AND reference_type = 'submission'`

#### Module B - Section 7: Performance Metrics

لكل مدرب نشط:
1. متوسط وقت الرد (من `messages` - الشهر الحالي فقط)
2. متوسط وقت التصحيح (من `assignment_submissions` - الشهر الحالي فقط)
3. عدد الانذارات والتذكيرات
4. عدد الطلاب والمجموعات (workload context)
5. `compute_quality_score()` مع workload weighting + soft floor 20
6. **Consistency Bonus**: اذا 0 warnings لمدة 3 اشهر متتالية --> +5 على score (غير دائم، الشهر الحالي فقط)
7. UPSERT في `instructor_performance_metrics`

#### Module C - Section 8: Incentive Engine

في نهاية كل شهر (آخر يوم):
- اذا مدرب 0 `no_reply` + 0 `late_grading` هذا الشهر --> اشعار للادمن يقترح مكافأة
- اذا متوسط تصحيح اقل من 24 ساعة --> bonus اضافي مقترح
- تسجيل `bonus_recommended` في `performance_events` مع details (score, metrics)
- **الادمن يوافق يدويا** من لوحة الاداء (safeguard)

#### Module D - Section 9: System Health

بعد انتهاء كل الـ modules:
- تسجيل UPSERT في `system_health_metrics`:
  - عدد التذكيرات + الانذارات + الخصومات المعلقة
  - وقت التنفيذ الاجمالي بالميلي ثانية
  - عدد الاخطاء
- هذا يتيح للادمن مراقبة: هل النظام يعمل بشكل صحي ام انه اصبح عدواني؟

---

## المرحلة 3: انشاء Edge Function لمعالجة الخصومات

### انشاء `supabase/functions/process-deductions/index.ts`

Edge Function منفصلة (تعمل بـ cron كل ساعة) تعالج الخصومات المعلقة:

1. جلب `performance_events WHERE event_type = 'deduction_pending' AND is_archived = false`
2. لكل خصم معلق:
   - التحقق من عدم وجود خصم مطبق سابقا لنفس القاعدة + نفس الشهر (idempotency)
   - تطبيق الخصم عبر `salary_events` INSERT
   - تحديث `performance_events` -> `deduction_applied` + archive الـ pending
3. هذا الفصل يمنع: double deduction, deadlocks, long transactions داخل trigger

---

## المرحلة 4: الغاء انشاء الواجبات من صفحة الواجبات

### تعديل `src/pages/Assignments.tsx`

ازالة:
- زر "Add Assignment" (سطور 336-345)
- Dialog الانشاء/التعديل بالكامل (سطور 348-472)
- State: `isDialogOpen`, `editingAssignment`, `formData`, `file`, `uploading`, `fileInputRef`
- دوال: `handleSubmit`, `handleEdit`, `handleFileChange`, `resetForm`
- خيار Edit من DropdownMenu
- Imports غير مستخدمة: `Plus`, `Upload`, `Pencil`, `X`, `Dialog*`, `Label`, `Textarea`

الابقاء على:
- عرض الواجبات + البحث + الفلترة
- حذف (admin فقط)
- عرض التسليمات + تسليم الطالب + navigation

---

## المرحلة 5: تحديث واجهات UI الحالية

### 5.1 `src/pages/DeductionRules.tsx`

- اضافة `no_reply` و `late_grading` لمصفوفة `warningTypes`
- اضافة اختيار `severity` (minor/major/critical) في الفورم
- اضافة اختيار `action` (deduction/suspension_recommendation)
- عرض severity و action و version في الجدول

### 5.2 `src/components/instructor/IssueEmployeeWarningDialog.tsx`

- اضافة `no_reply` و `late_grading` لمصفوفة `warningTypes`
- اضافة اختيار severity (minor/major/critical)

### 5.3 `src/pages/InstructorWarnings.tsx`

- اضافة badges للنوعين الجديدين (`no_reply`, `late_grading`) في `getWarningTypeBadge`
- اضافة stats cards للنوعين
- اضافة عمود severity في الجدول مع color coding (اخضر/اصفر/احمر)
- اضافة فلتر severity + فلتر للنوعين الجديدين

### 5.4 `src/pages/MyInstructorWarnings.tsx`

- اضافة النوعين في `getWarningTypeInfo`:
  - `no_reply`: ايقونة `MessageSquare`, لون ازرق
  - `late_grading`: ايقونة `Clock`, لون بنفسجي
- **اضافة SLA Status Widget**: مؤشر بسيط في اعلى الصفحة:
  - اخضر: كل شيء ضمن الوقت
  - اصفر: رد مطلوب خلال X ساعة
  - احمر: تجاوز SLA
  - هذا يمنع 70% من الانذارات قبل حدوثها (psychological design)
- تحديث نصائح تجنب الانذارات

### 5.5 `src/pages/Settings.tsx`

- اضافة النوعين في `systemWarningTypes`:
  - `{ id: '6', value: 'no_reply', labelEn: 'No Reply to Student', labelAr: 'عدم الرد على الطالب', isSystem: true }`
  - `{ id: '7', value: 'late_grading', labelEn: 'Late Grading', labelAr: 'تأخر في التقييم', isSystem: true }`

---

## المرحلة 6: لوحة اداء المدربين (صفحة جديدة)

### انشاء `src/pages/InstructorPerformanceDashboard.tsx`

المحتويات:

1. **كروت سريعة**: افضل مدرب (اعلى score)، اسوأ مدرب، متوسط Score العام، توصيات معلقة
2. **جدول ترتيبي** لكل مدرب:
   - Risk Level Indicator: اخضر (>=80) / اصفر (60-79) / احمر (<60)
   - Quality Score
   - Workload Ratio (طلاب / جروبات)
   - متوسط وقت الرد + التصحيح
   - عدد انذارات (30 يوم)
   - **Performance Trajectory**: سهم اخضر (بيتحسن) / احمر (بيتدهور) / رمادي (ثابت) - بمقارنة score الشهر الحالي بالسابق
   - **Risk Index**: `(critical*3) + (major*2) + (minor*1)` - لترتيب خطر الايقاف
3. **Trend Chart**: تطور Quality Score آخر 6 شهور (Recharts AreaChart)
4. **قسم توصيات المكافآت**: قائمة المدربين المؤهلين + زر "موافقة" يضيف bonus في `salary_events` ويسجل `bonus_approved` في `performance_events`
5. **Performance Events Log**: آخر 50 حدث غير archived من `performance_events`
6. **System Health Panel**: كروت صغيرة تعرض احصائيات `system_health_metrics` لآخر 7 ايام (total warnings trend, avg execution time, errors)

### تعديلات مصاحبة

- `src/components/AppSidebar.tsx`: اضافة رابط "اداء المدربين" في `settingsNavItems` (admin فقط) بايقونة `BarChart3`
- `src/App.tsx`: اضافة route `/instructor-performance` مع `ProtectedRoute allowedRoles={['admin']}`

---

## ملخص الملفات المتأثرة

| الملف | نوع التعديل |
|---|---|
| `supabase/migrations/...` | جديد: اعمدة + جداول + indexes + trigger تعديل + RLS + قواعد خصم + دالة |
| `supabase/functions/compliance-monitor/index.ts` | تعديل: 5 modules جديدة (SLA رسائل + SLA تقييم + metrics + incentives + health) |
| `supabase/functions/process-deductions/index.ts` | **جديد**: معالجة الخصومات المعلقة (منفصل عن trigger) |
| `src/pages/Assignments.tsx` | تعديل: ازالة كود الانشاء/التعديل |
| `src/pages/DeductionRules.tsx` | تعديل: نوعين + severity + action + version |
| `src/components/instructor/IssueEmployeeWarningDialog.tsx` | تعديل: نوعين + severity |
| `src/pages/InstructorWarnings.tsx` | تعديل: badges + severity + stats + فلاتر |
| `src/pages/MyInstructorWarnings.tsx` | تعديل: نوعين + SLA Status Widget |
| `src/pages/Settings.tsx` | تعديل: نوعين في systemWarningTypes |
| `src/pages/InstructorPerformanceDashboard.tsx` | **جديد**: لوحة اداء المدربين + System Health |
| `src/components/AppSidebar.tsx` | تعديل: رابط جديد |
| `src/App.tsx` | تعديل: route جديد + import |

---

## القرارات المعمارية النهائية

| القرار | السبب |
|---|---|
| `reference_type` + `reference_id` | UUID وحده لا يكفي - extensible مستقبلا |
| `version` في `warning_deduction_rules` | تتبع قانوني لاي قاعدة طُبقت على اي خصم |
| `is_archived` في `performance_events` | soft delete يحافظ على audit trail + يخفف Dashboard |
| Rolling 30 يوم | يفصل بين pattern وسلوك عارض |
| Deduction pending بدل تنفيذ فوري | يمنع race conditions + double deduction + deadlocks |
| `process-deductions` Edge Function منفصلة | عزل منطق الخصم عن trigger - يسهل اعادة المعالجة لو فشل جزء |
| Workload weighting في quality_score | عدالة للمدربين ذوي الحمل المرتفع |
| Consistency Bonus (+5 لـ 3 اشهر بدون warnings) | يشجع الاستقرار طويل المدى |
| Prevent reminder spam (12h cooldown) | يمنع اغراق المدرب بتذكيرات متكررة |
| Freeze SLA عند رد المدرب | يمنع احتساب تأخير خاطئ بعد الرد |
| Cap critical escalation | يمنع انفجار critical warnings |
| Circuit breaker (80% timeout) | يمنع crash شامل لو query واحدة علقت |
| `system_health_metrics` | مراقبة النظام نفسه - هل اصبح عدواني؟ |
| SLA Status Widget للمدرب | يمنع 70% من الانذارات قبل حدوثها (وقاية نفسية) |
| Snapshot عند suspension_recommendation | حماية قانونية لو المدرب اعترض |
| Risk Index formula | ترتيب خطر الايقاف لقرارات الموارد البشرية |
