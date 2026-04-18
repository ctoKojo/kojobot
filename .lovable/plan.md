# مراجعة شاملة لكونسبت الإنذارات (Instructor Warnings) — V2

> النسخة المحدّثة بعد ملاحظات المستخدم لإغلاق الـ 5 gaps الأساسية: grace periods متعددة، uniqueness في المنهج، منع race conditions، auto-resolve، batching strategy.

---

## 1. مشاكل الماضي اللي لازم متترجعش

| # | المشكلة | السبب الجذري |
|---|---------|--------------|
| 1 | إنذار لمجموعة فاضية (T38) | فلتر `group_students` ما كانش بيتأكد من `is_active = true` |
| 2 | إنذار قبل مرور وقت كافي (T15) | grace period موحّد 60د لكل الأنواع — غلط |
| 3 | إنذار لسيشن مفيش ليها واجب في المنهج | فحص بيعتمد على `is_published` بدل `assignment_attachment_url` |
| 4 | تكرار إنذارات | غياب unique index فعّال |
| 5 | إنذارات على dummy data | الاعتماد فقط على `is_auto_generated` |
| 6 | race condition (المدرب لسه بيضيف كويز) | مفيش buffer بعد نهاية grace |
| 7 | إنذارات لسيشنات قبل 17-4 (نظام لسه ما بدأش) | مفيش `MONITORING_START_DATE` |
| 8 | إنذارات بتفضل نشطة بعد ما السبب اتصلح | مفيش auto-resolve trigger |

---

## 2. القواعد الأساسية الجديدة (Source of Truth)

### 2.1 Grace Periods — مفصولة حسب النوع
```ts
const GRACE_PERIODS = {
  attendance: 60,        // دقيقة بعد نهاية السيشن (سريع)
  evaluation: 60 * 24,   // 24 ساعة (المدرب محتاج وقت يقيّم)
  quiz: 60 * 24,
  assignment: 60 * 24,
  reply: 60 * 24,        // SLA الرد
  grading: 60 * 48,      // SLA التصحيح
};
const RACE_BUFFER_MINUTES = 5;
```

### 2.2 MONITORING_START_DATE
```ts
const MONITORING_START_DATE = '2026-04-17';
```
أي سيشن قبل التاريخ ده **مش هتتفحص** نهائياً.

### 2.3 فلتر السيشنات الموحّد (`getEligibleSessions`)
```sql
SELECT s.*
FROM sessions s
JOIN groups g ON g.id = s.group_id
WHERE s.session_date >= '2026-04-17'
  AND s.session_date <= :cairo_today
  AND s.status IN ('scheduled', 'completed')   -- gap #1
  AND s.canceled_at IS NULL                    -- gap #1
  AND s.is_auto_generated = false              -- gap #5
  AND g.is_active = true
  AND g.status NOT IN ('frozen', 'completed', 'canceled')
  AND EXISTS (                                 -- gap #2
    SELECT 1 FROM group_students gs
    WHERE gs.group_id = g.id AND gs.is_active = true
  )
  AND is_past_grace_period(s.session_date, s.session_time, s.duration_minutes, :grace + 5) -- gap #6
ORDER BY s.session_date ASC, s.session_time ASC
LIMIT 500;
```

### 2.4 ضمان uniqueness في المنهج (gap #3)
```sql
CREATE UNIQUE INDEX IF NOT EXISTS uniq_curriculum_session_per_level_content
ON curriculum_sessions(level_id, session_number)
WHERE is_active = true;
```
لو السيشن مالهاش match في `curriculum_sessions` → **skip تماماً**.

### 2.5 قواعد كل نوع فحص
| نوع الإنذار | الشرط الإيجابي | الـ skip |
|------------|----------------|---------|
| `no_quiz` | `curriculum.quiz_id IS NOT NULL` | grace 24h لسه ما خلصش |
| `no_assignment` | `curriculum.assignment_attachment_url IS NOT NULL` | grace 24h لسه ما خلصش |
| `no_attendance` | `(present + absent) = 0` | لسه في فترة السيشن |
| `no_evaluation` | حضور موجود لكن مفيش evaluation للحاضرين | الكل غايب |
| `no_reply` | SLA reply > 24h | كما هو |
| `late_grading` | SLA grading > 48h | كما هو |

### 2.6 Idempotency
```ts
.upsert({...}, { onConflict: 'session_id,warning_type', ignoreDuplicates: true })
```

### 2.7 Auto-Resolve Triggers (gap #8)
- `trg_resolve_no_quiz` بعد إدراج `quiz_assignments`
- `trg_resolve_no_assignment` بعد إدراج `assignments`
- `trg_resolve_no_attendance` بعد إدراج `attendance`
- `trg_resolve_no_evaluation` بعد إدراج `session_evaluations`

كل واحد:
```sql
UPDATE instructor_warnings
SET is_active = false, resolved_at = now()
WHERE session_id = NEW.session_id
  AND warning_type = '<type>'
  AND is_active = true;
```

### 2.8 Batching — anti-starvation
بدل `LIMIT 500` ثابت من الأقدم:
- 70% (350) للأقدم اللي لسه ما اتفحصش
- 30% (150) لـ recent window (1-3 أيام)
- نسجّل `last_compliance_scan_at` على الـ session

### 2.9 Logging موحّد
كل run في `compliance_scan_runs`:
```
{ scan_type, started_at, finished_at, execution_time_ms,
  sessions_scanned, warnings_created, warnings_skipped,
  warnings_auto_resolved, errors }
```

---

## 3. خطة التنفيذ

### المرحلة A — DB foundations (migration)
1. UNIQUE INDEX على `curriculum_sessions(level_id, session_number)` partial
2. تأكيد `uniq_warning_per_session_type` partial unique index
3. عمود `resolved_at TIMESTAMPTZ` على `instructor_warnings`
4. عمود `last_compliance_scan_at TIMESTAMPTZ` على `sessions`
5. جدول `compliance_scan_runs` للـ metrics
6. الـ 4 auto-resolve triggers

### المرحلة B — refactor `compliance-monitor/index.ts`
1. helper موحّد `getEligibleSessions(graceMinutes)`
2. ثوابت `GRACE_PERIODS` + `MONITORING_START_DATE` + `RACE_BUFFER_MINUTES`
3. كل قسم بالـ grace المناسب
4. `no_attendance`: `(present + absent) = 0`
5. `no_quiz` / `no_assignment`: skip لو مفيش curriculum match
6. تسجيل metrics
7. Batching 70/30

### المرحلة C — Cleanup للداتا الحالية (insert tool)
soft-delete (is_active=false) للإنذارات النشطة المرتبطة بـ:
- مجموعات فاضية حالياً
- سيشنات مالهاش متطلبات في المنهج
- سيشنات `canceled_at IS NOT NULL`

### المرحلة D — التوثيق
memory جديد: `mem://features/compliance-warnings-rules`

---

## 4. الملفات المتأثرة
- `supabase/functions/compliance-monitor/index.ts` (refactor)
- migration A (DB foundations + triggers)
- insert tool (cleanup)
- memory file جديد

---

## 5. النتيجة المتوقعة
✅ مفيش إنذارات لمجموعات فاضية / سيشنات ملغاة
✅ grace periods مفصّلة + race buffer 5د
✅ مفيش إنذارات لسيشنات بدون متطلبات
✅ auto-resolve فوري
✅ مفيش starvation
✅ metrics لكل run
