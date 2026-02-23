

# نظام تقييم الطلاب - خطة التنفيذ النهائية (Production Hardened)

---

## اولا: قاعدة البيانات (Migration)

### جدول `evaluation_criteria`

معايير التقييم لكل فئة عمرية مع Rubric هيكلي.

| العمود | النوع | الوصف |
|--------|-------|-------|
| id | uuid PK | |
| age_group_id | uuid FK -> age_groups | الفئة العمرية |
| key | text NOT NULL | مفتاح فريد |
| name / name_ar | text NOT NULL | اسم المعيار |
| description / description_ar | text | وصف Rubric |
| rubric_levels | jsonb NOT NULL | `[{"value":0,"label":"Weak","label_ar":"ضعيف"}, ...]` |
| max_score | integer NOT NULL | اقصى درجة |
| display_order | integer DEFAULT 0 | |
| is_active | boolean DEFAULT true | |
| created_at | timestamptz DEFAULT now() | |

UNIQUE: `(age_group_id, key)`

### جدول `session_evaluations`

| العمود | النوع | الوصف |
|--------|-------|-------|
| id | uuid PK | |
| session_id | uuid FK -> sessions NOT NULL | |
| student_id | uuid NOT NULL | |
| evaluated_by | uuid NOT NULL | |
| criteria_snapshot | jsonb NOT NULL | نسخة المعايير وقت الحفظ |
| scores | jsonb NOT NULL | `{"key": value}` |
| total_behavior_score | numeric NOT NULL DEFAULT 0 | |
| max_behavior_score | numeric NOT NULL | محسوب server-side من snapshot |
| quiz_score | numeric | snapshot |
| quiz_max_score | numeric | |
| assignment_score | numeric | snapshot |
| assignment_max_score | numeric | |
| total_score | numeric GENERATED (behavior + quiz + assignment) STORED | |
| max_total_score | numeric GENERATED (max_behavior + quiz_max + assignment_max) STORED | |
| percentage | numeric GENERATED (total/max_total * 100) STORED | |
| notes | text | داخلي للمدرب والادمن فقط |
| student_feedback_tags | text[] | tags تظهر للطالب |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz DEFAULT now() | |

UNIQUE: `(session_id, student_id)`

**ملاحظة**: `max_total_score` يصبح generated column ايضا = `max_behavior_score + COALESCE(quiz_max_score, 0) + COALESCE(assignment_max_score, 0)` -- كل القيم محسوبة server-side ولا تعتمد على الواجهة.

### View للطلاب: `student_session_evaluations_view`

```text
CREATE VIEW student_session_evaluations_view
WITH (security_invoker = true) AS
SELECT
  id, session_id, student_id, evaluated_by,
  scores, total_behavior_score, max_behavior_score,
  quiz_score, quiz_max_score,
  assignment_score, assignment_max_score,
  total_score, max_total_score, percentage,
  student_feedback_tags,
  created_at, updated_at
FROM session_evaluations;
-- بدون notes
```

الطلاب يقرأوا من الـ view فقط. RLS على الجدول الاصلي تمنع الطالب من SELECT مباشر.

### Seed Data

**6-9 سنوات** (سلوكي: 70، كويز: 15، واجب: 15 = 100):

| المعيار | key | الدرجة | مستويات |
|---------|-----|--------|---------|
| الفهم البسيط | simple_understanding | 10 | 0/5/10 |
| التطبيق بمساعدة | guided_application | 15 | 0/8/15 |
| المحاولة والاستمرار | persistence | 10 | 0/5/10 |
| التركيز والانتباه | focus | 10 | 0/5/10 |
| التفاعل والمشاركة | participation | 10 | 0/5/10 |
| الالتزام بالقواعد | discipline | 5 | 0/3/5 |
| العمل الجماعي | teamwork | 5 | 0/3/5 |
| بونص | bonus | 5 | 0/3/5 |

**10-13 سنة** (سلوكي: 100، كويز: 25، واجب: 25 = 150):

| المعيار | key | الدرجة | مستويات |
|---------|-----|--------|---------|
| الفهم النظري | theoretical_understanding | 15 | 0/3/6/9/12/15 |
| التطبيق العملي | practical_application | 20 | 0/4/8/12/16/20 |
| حل المشكلات | problem_solving | 15 | 0/3/6/9/12/15 |
| التفكير المنطقي | logical_thinking | 10 | 0/2/4/6/8/10 |
| التفاعل والمشاركة | participation | 10 | 0/2/4/6/8/10 |
| التركيز والانتباه | focus | 10 | 0/2/4/6/8/10 |
| العمل الجماعي | teamwork | 10 | 0/2/4/6/8/10 |
| الالتزام والانضباط | discipline | 5 | 0/3/5 |
| مستوى التطور | improvement | 5 | 0/3/5 |

**14-18 سنة** (سلوكي: 120، كويز: 30، واجب/مشروع: 50 = 200):

| المعيار | key | الدرجة | مستويات |
|---------|-----|--------|---------|
| الفهم النظري العميق | deep_understanding | 15 | 0/3/6/9/12/15 |
| التطبيق العملي المستقل | independent_application | 25 | 0/5/10/15/20/25 |
| حل المشكلات | problem_solving | 20 | 0/4/8/12/16/20 |
| جودة الكود | code_quality | 15 | 0/3/6/9/12/15 |
| التفكير التحليلي | analytical_thinking | 10 | 0/2/4/6/8/10 |
| المشاركة التقنية | technical_participation | 10 | 0/2/4/6/8/10 |
| الالتزام بالمواعيد | punctuality | 10 | 0/2/4/6/8/10 |
| العمل الجماعي | teamwork | 10 | 0/2/4/6/8/10 |
| بونص | bonus | 5 | 0/3/5 |

---

## ثانيا: Triggers و Validation

### 1. Auto-update `updated_at`

```text
BEFORE UPDATE ON session_evaluations:
  NEW.updated_at = now()
  RETURN NEW
```

هذا يمنع التلاعب بـ `updated_at` ويضمن ان شرط 24 ساعة لا يمكن تجاوزه.

### 2. قيد 24 ساعة (يعتمد على updated_at المحمي)

```text
BEFORE UPDATE ON session_evaluations:
  IF OLD.created_at < now() - interval '24 hours'
  AND NOT has_role(auth.uid(), 'admin')
  THEN RAISE EXCEPTION 'Evaluation locked after 24 hours'
```

ملاحظة: الشرط على `created_at` وليس `updated_at` -- لان `updated_at` يتغير مع كل تعديل. القفل يعتمد على وقت الانشاء الاصلي.

### 3. Validation على scores (قيم ضمن rubric_levels فقط)

```text
BEFORE INSERT OR UPDATE ON session_evaluations:
  لكل key/value في NEW.scores:
    - استخرج rubric_levels من criteria_snapshot لنفس key
    - تحقق ان value موجودة ضمن القيم المسموحة في rubric_levels
    - اذا لا -> RAISE EXCEPTION 'Invalid score value for criteria key'
  
  لكل key في criteria_snapshot:
    - تحقق ان scores يحتوي على هذا key
    - اذا لا -> RAISE EXCEPTION 'Missing required criteria'
```

هذا يمنع ادخال اي قيمة خارج السلم المحدد.

### 4. حساب max_behavior_score server-side

```text
BEFORE INSERT OR UPDATE ON session_evaluations:
  NEW.max_behavior_score = SUM of max_score from criteria_snapshot
```

الواجهة لا ترسل max values -- السيرفر يحسبها من الـ snapshot.

### 5. منع التقييم بدون حضور مكتمل

```text
BEFORE INSERT ON session_evaluations:
  - تحقق ان attendance record موجود لنفس session_id + student_id
  - تحقق ان عدد attendance records للسيشن = عدد الطلاب النشطين في المجموعة
    (اي ان الحضور مكتمل لكل الطلاب، وليس مجرد وجود record واحد)
  - اذا لا -> RAISE EXCEPTION
```

هذا يضمن ان المدرب اكمل تسجيل الحضور لكل الطلاب قبل بدء التقييم.

### 6. التحقق من صلاحية المدرب

```text
BEFORE INSERT OR UPDATE ON session_evaluations:
  - تحقق ان evaluated_by هو instructor المجموعة (JOIN sessions->groups->instructor_id)
    او has_role(evaluated_by, 'admin')
  - اذا لا -> RAISE EXCEPTION 'Unauthorized evaluator'
```

### 7. تزامن الكويز والواجب (مع تغطية DELETE)

```text
AFTER INSERT OR UPDATE ON quiz_submissions:
  - ابحث عن session_evaluation لنفس الطالب والسيشن (عبر quiz_assignment -> session)
  - اذا موجود -> UPDATE quiz_score = NEW.score, quiz_max_score = NEW.max_score

AFTER DELETE ON quiz_submissions:
  - ابحث عن session_evaluation مرتبط
  - اذا موجود -> UPDATE quiz_score = NULL, quiz_max_score = NULL

AFTER INSERT OR UPDATE ON assignment_submissions:
  - نفس المنطق -> UPDATE assignment_score, assignment_max_score

AFTER DELETE ON assignment_submissions:
  - نفس المنطق -> UPDATE assignment_score = NULL, assignment_max_score = NULL
```

---

## ثالثا: Indexes للاداء

```text
-- البحث بالسيشن والطالب (اساسي)
CREATE UNIQUE INDEX ON session_evaluations (session_id, student_id);

-- ترتيب الطالب عبر الزمن
CREATE INDEX ON session_evaluations (student_id, created_at DESC);

-- ترتيب السيشن بالنسبة المئوية
CREATE INDEX ON session_evaluations (session_id, percentage DESC);

-- فلترة شهرية (للليدر بورد)
CREATE INDEX ON session_evaluations (student_id, (created_at::date));
```

---

## رابعا: RLS Policies

| الجدول/View | الدور | SELECT | INSERT | UPDATE | DELETE |
|-------------|-------|--------|--------|--------|--------|
| evaluation_criteria | admin | الكل | نعم | نعم | نعم |
| evaluation_criteria | instructor/student/reception | is_active فقط | لا | لا | لا |
| session_evaluations | admin | الكل | نعم | نعم | نعم |
| session_evaluations | instructor | مجموعاته (JOIN sessions->groups) | مجموعاته | مجموعاته | لا |
| session_evaluations | student | **لا** (يستخدم الـ view) | لا | لا | لا |
| session_evaluations | reception | الكل (قراءة) | لا | لا | لا |
| student_session_evaluations_view | student | تقييماته فقط (student_id = auth.uid()) | -- | -- | -- |

---

## خامسا: واجهة التقييم - `SessionEvaluationGrid.tsx`

### المكون الجديد

تبويب "التقييم" في `SessionDetails.tsx` (مدرب + ادمن).

**شروط الظهور**: الحضور مكتمل لكل الطلاب.

**طريقة الادخال:**
- **6-9**: ازرار ملونة (3 خيارات) + keyboard shortcuts 1/2/3
- **10-13 و 14-18**: ازرار متعددة من rubric_levels + keyboard shortcuts 1-6

**ميزات السرعة:**
- Auto-save per row بعد اختيار اخر معيار (مع مؤشر حفظ)
- زر "حفظ الكل" كـ fallback (bulk upsert لتقليل round trips)
- Keyboard navigation: Tab/اسهم بين الخلايا + ارقام للاختيار
- Tooltip على كل عمود يعرض الروبريك
- المجموع يتحسب لايف
- الكويز والواجب اعمدة قراءة فقط (تتملأ تلقائي)

**حساب server-side عند الحفظ:**
- الواجهة ترسل `scores` و `criteria_snapshot` فقط
- السيرفر (trigger) يحسب: `max_behavior_score`, `total_behavior_score`
- السيرفر يسحب `quiz_score/assignment_score` من الجداول المرتبطة تلقائي
- `total_score`, `max_total_score`, `percentage` كلها generated columns

**ملاحظات:**
- حقل notes داخلي (مدرب + ادمن فقط)
- حقل student_feedback_tags: tags جاهزة يختارها المدرب -- تظهر للطالب

---

## سادسا: صفحة Leaderboard - `/leaderboard`

### صفحة جديدة

الوصول: admin + instructor + student

**تبويبات:**
1. ترتيب اخر سيشن
2. ترتيب الشهر (AVG percentage)
3. ترتيب الليفل (AVG percentage)

**فلاتر:** المجموعة + الفئة العمرية (للادمن)

**العرض:**
- المركز (ميدالية لاول 3) + الطالب + النقاط + النسبة + الفرق + Grade Band

**Grade Bands (14-18):** A: 90%+ | B: 80-89% | C: 70-79% | D: اقل من 60%

**جوائز:**
- Most Improved: فرق متوسط اخر 4 اسابيع vs السابق
- Best Problem Solver: اعلى متوسط problem_solving
- Best Code Quality: اعلى متوسط code_quality (14-18)
- Best Consistency: اقل انحراف معياري

**6-9 سنوات:** بطاقات "نجوم الاسبوع" بدل ترتيب رقمي (نجمة المجتهد / التعاون / التطور)

---

## سابعا: Routing والتنقل

- `App.tsx`: route `/leaderboard` لكل الادوار
- `AppSidebar.tsx`: رابط Leaderboard في الاقسام المناسبة لكل دور

---

## ثامنا: الترجمات (i18n)

namespace `evaluation` في `src/lib/i18n.ts` يشمل كل عناصر التقييم والليدر بورد والتنبيهات.

---

## تاسعا: ملخص الملفات

| الملف | التغيير |
|-------|---------|
| Migration SQL | جداول + view + seed + RLS + triggers (7 triggers) + indexes |
| `src/components/session/SessionEvaluationGrid.tsx` | **جديد** |
| `src/pages/SessionDetails.tsx` | تبويب التقييم |
| `src/pages/Leaderboard.tsx` | **جديد** |
| `src/App.tsx` | route |
| `src/components/AppSidebar.tsx` | رابط |
| `src/lib/i18n.ts` | ترجمات |

---

## عاشرا: ترتيب التنفيذ

1. **Migration**: جداول + view + seed + RLS + كل الـ triggers + indexes
2. **i18n**: ترجمات
3. **SessionEvaluationGrid**: مكون التقييم (auto-save + keyboard + bulk upsert)
4. **تكامل SessionDetails**: تبويب التقييم
5. **Leaderboard**: صفحة الترتيب + routing + sidebar

