

# نظام إتمام المستوى والامتحان النهائي وتقدم الطالب الفردي - النسخة النهائية المحكمة

## ملخص التعديلات الجوهرية عن النسخة السابقة

1. **اضافة `level_id` على جدول `sessions`** - لربط كل سيشن بالمستوى الذي أُنشئت فيه (النقطة الأخطر)
2. **الغاء trigger لـ `groups.level_status`** واستبداله بـ RPC/function يُستدعى وقت فتح الصفحة فقط
3. **اضافة timestamps تفصيلية** على `group_student_progress` (`exam_scheduled_at`, `exam_submitted_at`, `graded_at`)

---

## المرحلة 1: تغييرات قاعدة البيانات (Migration)

### 1.1 تعديل جدول `sessions` (حرج)

```sql
ALTER TABLE public.sessions
  ADD COLUMN level_id UUID REFERENCES public.levels(id);
```

- يُملأ تلقائيا عند انشاء السيشن من `groups.level_id` الحالي وقت الانشاء
- تعديل كل الأماكن التي تنشئ سيشنات:
  - `start-group` edge function: يضيف `level_id: group.level_id` عند insert
  - `auto_generate_next_session` trigger: يضيف `level_id` من `groups.level_id`
  - `generate-sessions` edge function: نفس الشيء
  - `schedule_makeup_session` RPC: يأخذ `level_id` من الجروب أو من `group_student_progress`
- **Backfill** للسيشنات الحالية:
  ```sql
  UPDATE sessions s SET level_id = g.level_id FROM groups g WHERE s.group_id = g.id AND s.level_id IS NULL;
  ```

### 1.2 جدول `tracks` (جديد)

```text
tracks
------
id          UUID PK DEFAULT gen_random_uuid()
name        TEXT NOT NULL UNIQUE    -- 'Software'
name_ar     TEXT NOT NULL           -- 'برمجيات'
is_active   BOOLEAN DEFAULT true
created_at  TIMESTAMPTZ DEFAULT now()
```

- **Seed data**: Insert 'Software' و 'Hardware' (من البيانات الحالية في `levels.track`)

### 1.3 تعديل جدول `levels`

```sql
ALTER TABLE public.levels
  ADD COLUMN final_exam_quiz_id UUID REFERENCES public.quizzes(id),
  ADD COLUMN pass_threshold NUMERIC DEFAULT 50,
  ADD COLUMN track_id UUID REFERENCES public.tracks(id);
```

- **ترحيل البيانات**: `UPDATE levels SET track_id = (SELECT id FROM tracks WHERE name = levels.track) WHERE track IS NOT NULL`
- عمود `track` (TEXT) الحالي يبقى مؤقتا للتوافق، ثم يُزال لاحقا

### 1.4 تعديل جدول `groups`

```sql
ALTER TABLE public.groups
  ADD COLUMN level_status TEXT DEFAULT 'in_progress'
    CHECK (level_status IN ('in_progress','sessions_completed','exam_scheduled','exam_done','grades_computed'));
```

- **Informational فقط** - لا يوجد trigger يحدثه تلقائيا
- يُحدث فقط من داخل RPCs الادمن أو من function تُستدعى عند فتح الصفحة

### 1.5 جدول `group_student_progress` (جديد)

```text
group_student_progress
----------------------
id                    UUID PK DEFAULT gen_random_uuid()
group_id              UUID NOT NULL FK -> groups.id
student_id            UUID NOT NULL FK -> profiles.user_id
current_level_id      UUID NOT NULL FK -> levels.id
current_track_id      UUID nullable FK -> tracks.id
status                TEXT NOT NULL DEFAULT 'in_progress'
                      CHECK (status IN ('in_progress','awaiting_exam','exam_scheduled','graded','paused'))
outcome               TEXT nullable
                      CHECK (outcome IS NULL OR outcome IN ('passed','failed','repeat'))
level_started_at      TIMESTAMPTZ DEFAULT now()
level_completed_at    TIMESTAMPTZ nullable
next_level_id         UUID nullable FK -> levels.id
exam_scheduled_at     TIMESTAMPTZ nullable
exam_submitted_at     TIMESTAMPTZ nullable
graded_at             TIMESTAMPTZ nullable
notes                 TEXT nullable
created_at            TIMESTAMPTZ DEFAULT now()
updated_at            TIMESTAMPTZ DEFAULT now()
UNIQUE (group_id, student_id)
```

### 1.6 جدول `level_grades` (جديد)

```text
level_grades
------------
id                    UUID PK DEFAULT gen_random_uuid()
student_id            UUID NOT NULL FK -> profiles.user_id
group_id              UUID NOT NULL FK -> groups.id
level_id              UUID NOT NULL FK -> levels.id
evaluation_avg        NUMERIC nullable    -- من 100
final_exam_score      NUMERIC nullable    -- من 100
total_score           NUMERIC GENERATED ALWAYS AS (COALESCE(evaluation_avg,0) + COALESCE(final_exam_score,0)) STORED
percentage            NUMERIC GENERATED ALWAYS AS ((COALESCE(evaluation_avg,0) + COALESCE(final_exam_score,0)) / 2.0) STORED
outcome               TEXT nullable       -- 'passed' | 'failed' | 'repeat'
graded_by             UUID nullable
notes                 TEXT nullable       -- مخفي عن الطلاب والمدربين
created_at            TIMESTAMPTZ DEFAULT now()
updated_at            TIMESTAMPTZ DEFAULT now()
UNIQUE (student_id, group_id, level_id)
```

- لا يوجد عمود `passed` منفصل - `outcome` وحده يكفي

### 1.7 جدول `student_track_choices` (جديد)

```text
student_track_choices
---------------------
id              UUID PK DEFAULT gen_random_uuid()
student_id      UUID NOT NULL FK -> profiles.user_id
group_id        UUID NOT NULL FK -> groups.id
from_level_id   UUID NOT NULL FK -> levels.id
chosen_track_id UUID NOT NULL FK -> tracks.id
chosen_at       TIMESTAMPTZ DEFAULT now()
chosen_by       UUID NOT NULL
created_at      TIMESTAMPTZ DEFAULT now()
UNIQUE (student_id, group_id, from_level_id)
```

### 1.8 جدول `student_level_transitions` (جديد - سجل تاريخي)

```text
student_level_transitions
-------------------------
id              UUID PK DEFAULT gen_random_uuid()
student_id      UUID NOT NULL FK -> profiles.user_id
group_id        UUID NOT NULL FK -> groups.id
from_level_id   UUID NOT NULL FK -> levels.id
to_level_id     UUID NOT NULL FK -> levels.id
reason          TEXT       -- 'passed' | 'admin_override' | 'repeat'
created_at      TIMESTAMPTZ DEFAULT now()
created_by      UUID NOT NULL
```

### 1.9 Unique Index على `quiz_assignments` (Idempotency)

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_assignment_student_quiz_group
ON quiz_assignments (quiz_id, student_id, group_id)
WHERE student_id IS NOT NULL AND group_id IS NOT NULL;
```

### 1.10 Triggers

1. **`updated_at`** trigger على `level_grades` و `group_student_progress`
2. **Auto-create progress**: Trigger على `group_students` INSERT:
   ```sql
   -- ينشئ صف في group_student_progress
   -- current_level_id = (SELECT level_id FROM groups WHERE id = NEW.group_id)
   -- status = 'in_progress'
   ```
3. **`auto_generate_next_session` تعديل**: يضيف `level_id` من `groups.level_id` عند انشاء السيشن التالية
4. **لا يوجد trigger لـ `groups.level_status`** - يُحسب عند الطلب فقط

### 1.11 RLS Policies

**`tracks`**: SELECT للجميع (authenticated)، INSERT/UPDATE/DELETE للأدمن

**`level_grades`**:
- Admin: full CRUD
- Instructor: SELECT لطلاب مجموعاته (بدون `notes`)
- Student: SELECT لدرجاته فقط (بدون `notes`)
- Reception: SELECT only

**`group_student_progress`**:
- Admin: full CRUD
- Instructor: SELECT + UPDATE لطلاب مجموعاته
- Student: SELECT لسجله فقط
- Reception: SELECT only

**`student_track_choices`**: Admin full CRUD، Instructor/Student/Reception SELECT فقط (حسب الصلاحية)

**`student_level_transitions`**: Admin INSERT + SELECT، Others SELECT (حسب الصلاحية)

### 1.12 Realtime

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_student_progress;
```

---

## المرحلة 2: RPCs (Database Functions)

### 2.1 `create_level_final_exam(p_level_id UUID)`

- Admin only (SECURITY DEFINER + `has_role` check)
- `SELECT ... FOR UPDATE` على levels لمنع التكرار
- يرفض لو `final_exam_quiz_id` موجود بالفعل
- ينشئ كويز جديد ويربطه بـ `levels.final_exam_quiz_id`
- يرجع `{ quiz_id: UUID }`

### 2.2 `get_group_level_status(p_group_id UUID)`

- بديل الـ trigger - function خفيفة تُستدعى وقت فتح الصفحة
- تحسب الحالة الغالبة من `group_student_progress` وترجعها
- تحدث `groups.level_status` اختياريا (cache)
- ترجع:
  ```json
  {
    "level_status": "sessions_completed",
    "total_students": 8,
    "in_progress": 0,
    "awaiting_exam": 5,
    "exam_scheduled": 3,
    "graded": 0,
    "passed": 0,
    "failed": 0
  }
  ```

### 2.3 `schedule_final_exam_for_students(p_group_id, p_student_ids[], p_date, p_duration)`

- Admin only
- **شرط اكتمال السيشنات مرتبط بالمستوى الحالي لكل طالب عبر `sessions.level_id`**:
  ```sql
  WITH student_completion AS (
    SELECT gsp.student_id, gsp.current_level_id,
      (SELECT COUNT(DISTINCT a.session_id)
       FROM attendance a
       JOIN sessions s ON s.id = a.session_id
       WHERE s.group_id = p_group_id
         AND s.level_id = gsp.current_level_id   -- الفلتر الحرج
         AND a.student_id = gsp.student_id
         AND a.status IN ('present', 'late')
         AND s.status = 'completed'
      ) as completed_count,
      l.expected_sessions_count
    FROM group_student_progress gsp
    JOIN levels l ON l.id = gsp.current_level_id
    WHERE gsp.group_id = p_group_id
      AND gsp.student_id = ANY(p_student_ids)
      AND gsp.status IN ('in_progress', 'awaiting_exam')
  )
  SELECT * FROM student_completion
  WHERE completed_count >= expected_sessions_count;
  ```
- **Idempotent**: يستخدم `ON CONFLICT DO NOTHING` على الـ unique index الجديد
- ينشئ `quiz_assignment` لكل طالب مؤهل
- يحدث `group_student_progress`: `status = 'exam_scheduled'`, `exam_scheduled_at = now()`
- يتحقق ان `levels.final_exam_quiz_id` موجود

### 2.4 `compute_level_grades_batch(p_group_id UUID)`

- Admin only
- **Set-based** - استعلام واحد + UPSERT جماعي
- **`evaluation_avg` مفلتر بـ `sessions.level_id`**:
  ```sql
  WITH current_level AS (
    SELECT DISTINCT current_level_id FROM group_student_progress
    WHERE group_id = p_group_id AND status = 'exam_scheduled'
    LIMIT 1
  ),
  eval_avgs AS (
    SELECT se.student_id,
      ROUND(AVG(se.percentage)) as evaluation_avg
    FROM session_evaluations se
    JOIN sessions s ON s.id = se.session_id
    WHERE s.group_id = p_group_id
      AND s.level_id = (SELECT current_level_id FROM current_level)  -- الفلتر الحرج
      AND s.status = 'completed'
    GROUP BY se.student_id
  ),
  exam_scores AS (
    SELECT qs.student_id,
      qs.percentage as final_exam_score
    FROM quiz_submissions qs
    JOIN quiz_assignments qa ON qa.id = qs.quiz_assignment_id
    WHERE qa.quiz_id = v_final_exam_quiz_id
      AND qa.group_id = p_group_id
      AND qs.status = 'submitted'
      AND qs.submitted_at = (
        SELECT MAX(qs2.submitted_at)
        FROM quiz_submissions qs2
        WHERE qs2.quiz_assignment_id = qs.quiz_assignment_id
          AND qs2.student_id = qs.student_id
          AND qs2.status = 'submitted'
      )
  )
  INSERT INTO level_grades (student_id, group_id, level_id,
    evaluation_avg, final_exam_score, outcome, graded_by)
  SELECT ea.student_id, p_group_id, v_level_id,
    ea.evaluation_avg, es.final_exam_score,
    CASE WHEN ((COALESCE(ea.evaluation_avg,0) + COALESCE(es.final_exam_score,0)) / 2.0)
      >= v_pass_threshold THEN 'passed' ELSE 'failed' END,
    auth.uid()
  FROM eval_avgs ea
  LEFT JOIN exam_scores es ON es.student_id = ea.student_id
  ON CONFLICT (student_id, group_id, level_id)
  DO UPDATE SET
    evaluation_avg = EXCLUDED.evaluation_avg,
    final_exam_score = EXCLUDED.final_exam_score,
    outcome = EXCLUDED.outcome,
    graded_by = EXCLUDED.graded_by,
    updated_at = now();
  ```
- يحدث `group_student_progress`: `status = 'graded'`, `outcome = 'passed'/'failed'`, `graded_at = now()`
- يحدث `groups.level_status = 'grades_computed'` (cache update)

### 2.5 `upgrade_student_level(p_student_id, p_group_id, p_chosen_track_id UUID DEFAULT NULL)`

- Admin only
- يتحقق `outcome = 'passed'` في `group_student_progress`
- **في transaction واحد**:
  1. يسجل في `student_level_transitions` (from, to, reason='passed') **اولا**
  2. لو المستوى الحالي يحتاج اختيار مسار + `p_chosen_track_id` مقدم:
     - يتحقق ان الطالب `current_level_id` هو المستوى اللي بيتفرع (مثلا Level 1 اللي `parent_level_id` بتاع levels تانية بتشير له)
     - يتحقق ان `outcome = 'passed'`
     - يحفظ في `student_track_choices` (unique يمنع التكرار)
     - يحدد next_level_id: `SELECT id FROM levels WHERE parent_level_id = current_level_id AND track_id = p_chosen_track_id`
     - لو `next_level_id IS NULL`: يرفض ويرجع خطأ "No matching level found for this track"
  3. لو المستوى بدون تفرع:
     - يحدد next_level_id بناء على `level_order + 1` مع نفس `track_id`
     - لو مفيش: يرجع "No next level available"
  4. يحدث `group_student_progress`:
     - `level_completed_at = now()` (للمستوى القديم)
     - `current_level_id = next_level_id`
     - `current_track_id = p_chosen_track_id` (لو applicable)
     - `status = 'in_progress'`
     - `outcome = NULL`
     - `level_started_at = now()`
     - يمسح timestamps: `exam_scheduled_at = NULL`, `exam_submitted_at = NULL`, `graded_at = NULL`
- **لا يغير** `groups.level_id` ابدا

### 2.6 `mark_student_repeat(p_student_id, p_group_id)`

- Admin only
- يحدث `group_student_progress.outcome = 'repeat'`
- يسجل في `student_level_transitions` (reason = 'repeat')
- يعيد `status = 'in_progress'` عشان الطالب يبدا من اول

---

## المرحلة 3: تعديل Edge Functions و Triggers الحالية

### 3.1 `start-group/index.ts`
- عند insert sessions: يضيف `level_id: group.level_id`

### 3.2 `generate-sessions/index.ts`
- عند insert session جديد: يضيف `level_id` من `groups.level_id`

### 3.3 `auto_generate_next_session` trigger (في الداتابيز)
- يضيف `level_id` من `groups.level_id` عند انشاء السيشن التالية

### 3.4 `grade-quiz/index.ts`
- بعد حفظ `quiz_submission` بنجاح:
  1. يتحقق: هل الكويز هو `final_exam_quiz_id` لمستوى ما؟
     ```sql
     SELECT l.id FROM levels l WHERE l.final_exam_quiz_id = :quiz_id
     ```
  2. لو أيوه + submission status = 'submitted':
     - يحدث `group_student_progress.exam_submitted_at = now()` (الطالب سلم الامتحان)
     - **لا يغير status لـ graded** (graded = الدرجات النهائية اتحسبت من `compute_level_grades_batch`)
  3. لو كل الطلاب المجدولين سلموا: يحدث `groups.level_status = 'exam_done'`

### 3.5 `schedule_makeup_session` RPC (تعديل)
- عند انشاء session تعويضية: يضيف `level_id` من `group_student_progress.current_level_id` أو من السيشن الأصلية

---

## المرحلة 4: تغييرات الواجهة (Frontend)

### 4.1 `src/lib/constants.ts`

```typescript
export type StudentProgressStatus = 'in_progress' | 'awaiting_exam' | 'exam_scheduled' | 'graded' | 'paused';
export type StudentOutcome = 'passed' | 'failed' | 'repeat';
export type GroupLevelStatus = 'in_progress' | 'sessions_completed' | 'exam_scheduled' | 'exam_done' | 'grades_computed';

export const STUDENT_PROGRESS_STATUSES = { ... };  // مع labels بالعربي والانجليزي
export const STUDENT_OUTCOMES = { ... };
export const GROUP_LEVEL_STATUSES = { ... };
```

### 4.2 `src/pages/Levels.tsx`

- عمود جديد **"الامتحان النهائي"**:
  - لو `final_exam_quiz_id = null`: زر "انشاء امتحان" -> RPC `create_level_final_exam`
  - لو موجود: زر "تعديل الأسئلة" -> navigate `/quiz-editor/:quizId`
- عمود **"نسبة النجاح"** (`pass_threshold`) قابل للتعديل في dialog التعديل
- ربط `track` dropdown بجدول `tracks` بدل hardcoded values

### 4.3 `src/pages/GroupDetails.tsx`

**Tab جديد "تقدم المستوى" (Level Progress)**:

- يستدعي `get_group_level_status` RPC عند فتح الصفحة
- يجلب `group_student_progress` + `level_grades`
- **جدول لكل طالب**:

```text
| الطالب | الحالة | النتيجة | سيشنات مكتملة | امتحان | تقييم/100 | امتحان/100 | مجموع/200 | % | اجراءات |
```

- **فلاتر سريعة** (chips):
  - الكل | جاهزين للامتحان | امتحان مجدول | تم التقييم | محتاجين مسار | راسبين

- **Banner حالة المستوى** (derived من RPC):
  - `sessions_completed`: "السيشنات اكتملت - حدد موعد الامتحان النهائي"
  - `exam_scheduled`: "الامتحان مجدول" + عداد من سلم/لم يسلم
  - `exam_done`: "الامتحان انتهى - احسب الدرجات النهائية"
  - `grades_computed`: "الدرجات محسوبة - راجع النتائج"

- **Actions (Admin only)**:
  - "جدول الامتحان النهائي": Dialog بتاريخ + مدة + اختيار الطلاب المؤهلين
  - "احسب الدرجات النهائية": زر -> `compute_level_grades_batch`
  - لكل طالب ناجح: "ترقية" (+ اختيار مسار لو Level 1) -> `upgrade_student_level`
  - لكل طالب راسب: "اعادة المستوى" -> `mark_student_repeat`

### 4.4 `src/pages/StudentProfile.tsx`

- **Section جديد "سجل المستويات" (Level History)**:
  - يجلب `level_grades` + `student_level_transitions`
  - يعرض كل مستوى: اسم + تقييم/100 + امتحان/100 + مجموع/200 + % + outcome
  - المسار المختار (من `student_track_choices`)

### 4.5 `src/components/student/EvaluationSummary.tsx`

- اضافة قسم **"حالة المستوى الحالي"**:
  - يجلب `group_student_progress` (آخر مجموعة نشطة)
  - يعرض: المستوى + الحالة + النتيجة + الدرجة النهائية (لو موجودة)

---

## الملفات المتأثرة

| الملف | نوع التغيير |
|-------|-------------|
| Migration SQL | تعديل `sessions` + `levels` + `groups` + 5 جداول جديدة + unique index + RPCs + RLS + Triggers |
| `supabase/functions/start-group/index.ts` | اضافة `level_id` عند insert sessions |
| `supabase/functions/generate-sessions/index.ts` | اضافة `level_id` عند insert session |
| `supabase/functions/grade-quiz/index.ts` | تحديث `exam_submitted_at` بعد تسليم امتحان نهائي |
| `src/lib/constants.ts` | Types + Labels جديدة |
| `src/pages/Levels.tsx` | عمود امتحان نهائي + pass_threshold + tracks dropdown |
| `src/pages/GroupDetails.tsx` | Tab تقدم المستوى + Banner + Actions + Filters |
| `src/pages/StudentProfile.tsx` | Section سجل المستويات |
| `src/components/student/EvaluationSummary.tsx` | حالة المستوى الحالي |

---

## ترتيب التنفيذ المقترح

1. **Migration**: كل الجداول والاعمدة والـ backfill و RPCs و RLS (دفعة واحدة)
2. **Edge Functions**: تعديل `start-group` + `generate-sessions` + `grade-quiz`
3. **Constants**: اضافة الـ types والـ labels
4. **Levels.tsx**: امتحان نهائي + pass_threshold
5. **GroupDetails.tsx**: Tab تقدم المستوى
6. **StudentProfile.tsx** + **EvaluationSummary.tsx**: عرض سجل المستويات

---

## ضمانات سلامة البيانات

1. **`sessions.level_id`**: كل سيشن مربوطة بالمستوى اللي اتعملت فيه - يحل مشكلة التقدم الفردي نهائيا
2. **لا trigger لـ `groups.level_status`**: يُحسب عند الطلب فقط عبر RPC - يمنع deadlocks وloops
3. **فصل status عن outcome**: 5 حالات مرحلة + 3 نتائج
4. **Timestamps تفصيلية**: `exam_scheduled_at`, `exam_submitted_at`, `graded_at` للتقارير بدون statuses اضافية
5. **`groups.level_id` ثابت**: لا يتغير تلقائيا ابدا
6. **Set-based computation**: استعلام واحد + UPSERT جماعي
7. **Idempotent scheduling**: unique partial index على quiz_assignments
8. **اخر محاولة فقط**: `MAX(submitted_at)` للامتحان النهائي
9. **اختيار المسار مرة واحدة**: unique constraint + تحقق ان الطالب فعلا ناجح ووصل لنقطة التفرع
10. **Transition logging اولا**: يسجل قبل update في transaction واحد
11. **`pass_threshold` per level**: قابل للتخصيص
12. **Notes مخفية**: عبر RLS بدون notes للطلاب والمدربين
13. **لا حذف للسيشنات**: ارشيف دائم
14. **`upgrade_student_level` يقفل لو `next_level_id` = null**: يمنع ترقية لمستوى غير موجود

