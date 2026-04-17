

## الخطة النهائية المحدثة (Production-Grade)

### 1. تفعيل الإكستنشنز + جدولة الكرون
**Migration جديدة:**
```sql
-- ضمان تفعيل الإكستنشنز
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- حفظ CRON_SECRET كـ DB setting (لو مش موجود)
ALTER DATABASE postgres SET app.cron_secret = '<from vault>';

-- 3 cron jobs
SELECT cron.schedule('auto-complete-sessions', '*/15 * * * *', $$...$$);
SELECT cron.schedule('compliance-monitor', '0 * * * *', $$...$$);
SELECT cron.schedule('session-reminders', '*/30 * * * *', $$...$$);
```

### 2. منع تكرار الإنذارات على مستوى DB (Idempotency)
**Migration:**
```sql
-- partial unique index (يسمح بإنذارات مختلفة لنفس السيشن لكن يمنع التكرار)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_warning_per_session_type
ON instructor_warnings(session_id, warning_type)
WHERE session_id IS NOT NULL AND is_active = true;
```
ده بيخلي أي محاولة insert ثانية بترجع conflict تلقائياً → الكود يستخدم `.upsert(..., { onConflict: 'session_id,warning_type', ignoreDuplicates: true })`.

### 3. إصلاح `compliance-monitor/index.ts`

**أ) الفلترة بالوقت بدل الـ status فقط:**
```typescript
// قديم: .eq('status', 'completed')
// جديد: نفحص أي سيشن عدى عليها 60 دقيقة من end time
.lte('session_date', getCairoToday())
.in('status', ['completed', 'scheduled']) // نشمل scheduled العالقة
// + فلتر إضافي بالكود: نتأكد إن (session_date + session_time + duration + 60min) < now()
```

**ب) curriculum validation آمن (multi-assets):**
```typescript
const assets = cs?.curriculum_session_assets || [];
const expectsQuiz = assets.some(a => a.quiz_id);
const expectsAssignment = assets.some(a => a.assignment_title);
if (!expectsQuiz) skip 'no_quiz';
if (!expectsAssignment) skip 'no_assignment';
```

**ج) Evaluation check دقيق (مقارنة على مستوى الطلاب):**
```typescript
const { data: presentStudents } = await supabase
  .from('attendance')
  .select('student_id')
  .eq('session_id', session.id)
  .eq('status', 'present');

const { data: evaluatedStudents } = await supabase
  .from('session_evaluations')
  .select('student_id')
  .eq('session_id', session.id);

const presentSet = new Set(presentStudents?.map(s => s.student_id) || []);
const evalSet = new Set(evaluatedStudents?.map(s => s.student_id) || []);
const missing = [...presentSet].filter(id => !evalSet.has(id));

if (missing.length > 0) → issue 'no_evaluation' warning;
```

**د) Auth strict + batching:**
```typescript
const auth = req.headers.get('Authorization') || '';
if (auth !== `Bearer ${SERVICE_ROLE}` && auth !== `Bearer ${CRON_SECRET}`) {
  return 401;
}

// batching للسيشنات المتراكمة
.limit(100)
.order('session_date', { ascending: true })
```

### 4. تشغيل دفعة فورية للسيشنات المتأخرة
بعد تطبيق الـ migration، نستدعي الـ functions يدوياً:
- `auto-complete-sessions` لإقفال السيشنات العالقة
- `compliance-monitor` لإصدار الإنذارات للسيشنات المتراكمة (آخر 14 يوم)

batch size محدود بـ 100 سيشن في كل run.

---

## ملخص الفروقات عن الخطة السابقة

| النقطة | السابق | المحدث |
|--------|--------|--------|
| pg_cron extension | غير مذكور | `CREATE EXTENSION IF NOT EXISTS` |
| Status filter | `eq('completed')` فقط | time-based + multi-status |
| curriculum_session_assets | `[0]` (هش) | `.some()` على array |
| Evaluation check | count-based | student-set comparison |
| Idempotency | check بالكود فقط | DB-level partial unique index |
| Batching | غير محدد | `.limit(100)` + ordered |
| Auth في الـ function | موجود لكن نتأكد منه | strict bearer match |

## الملفات اللي هتتعدل
- `supabase/migrations/<new>.sql` — extensions + cron schedules + unique index
- `supabase/functions/compliance-monitor/index.ts` — كل التعديلات الـ 4 (a/b/c/d)
- استدعاء الـ functions يدوياً مرة بعد deploy

## الذاكرة هتتحدث
- `mem://logic/automated-task-idempotency` — إضافة DB-level unique index كطبقة ثانية
- ذاكرة جديدة `mem://features/compliance-warnings-system` — توثق:
  - time-based filtering (مش status فقط)
  - curriculum-aware (skip لو السيشن ملهاش quiz/assignment)
  - student-set comparison في الـ evaluation
  - batch size 100

