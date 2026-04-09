

# خطة: تحويل نظام XP ليكون Level-Scoped + تحسين UI

## الوضع الحالي

| العنصر | الحالة |
|--------|--------|
| جدول `student_xp_events` | موجود — **مفيش `level_id`** |
| Triggers (3) | attendance, quiz, assignment — **مفيش `level_id`** |
| Evaluation XP trigger | **غير موجود** |
| Level completion XP trigger | **غير موجود** |
| Unique constraint (anti-duplicate) | **غير موجود** — الحماية بـ `NOT EXISTS` فقط |
| UI للطالب | **مفيش** — الداتا بتتسجل بدون عرض |
| بيانات موجودة | 466 record (243 attendance + 223 assignment) |

## الخطوات

### 1. Migration: إضافة `level_id` + Unique Constraint

- إضافة عمود `level_id uuid REFERENCES levels(id)` لجدول `student_xp_events`
- إضافة `UNIQUE(student_id, event_type, reference_id)` لمنع double-counting
- إنشاء index على `(student_id, level_id)`

### 2. Migration: تعديل الـ 3 Triggers + إضافة 2 جداد

**تعديل الموجود:**
- `grant_xp_on_attendance` → يجيب `level_id` من `sessions.level_id` ويسجله
- `grant_xp_on_quiz_grade` → يجيب `level_id` من `quiz_assignments → sessions.level_id`
- `grant_xp_on_assignment_grade` → يجيب `level_id` من `assignments → sessions.level_id`

**إضافة جديد:**
- `grant_xp_on_evaluation` — trigger على `session_evaluations`:
  - `XP = ROUND((percentage / 100) * 30)` — max 30 XP
  - يسجل `level_id` من `sessions.level_id`
- `grant_xp_on_level_completion` — trigger على `group_student_progress` لما `outcome` يتغير:
  - `passed` → +200 XP
  - `failed_exam` / `failed_total` → +50 XP
  - `level_id` = `current_level_id`

### 3. Backfill الداتا القديمة

SQL update يربط الـ 466 record الموجودين بالـ `level_id` الصحيح:
- attendance events → `sessions.level_id` عن طريق `reference_id = session_id`
- assignment events → `assignment_submissions → assignments → sessions.level_id`

### 4. RPC Function: `get_student_level_xp`

Parameters: `p_student_id uuid`

Returns per level:
- `level_id`, `level_name`, `level_name_ar`
- `total_xp` (SUM within level)
- `rank_name` (Rookie/Explorer/Warrior/Champion/Legend)
- `rank_progress` (% toward next rank)
- `event_breakdown` (attendance XP, quiz XP, etc.)

Rank thresholds:
```text
Rookie:    0-199
Explorer:  200-499
Warrior:   500-899
Champion:  900-1399
Legend:    1400+
```

### 5. UI: كومبوننت `StudentXpCard`

ملف جديد: `src/components/dashboard/StudentXpCard.tsx`

يعرض:
- اسم المستوى الحالي
- Rank badge مع أيقونة (🏅)
- XP bar → progress للرانك الجاي
- Streak الحالي من `student_streaks`
- آخر 5 XP events (timeline صغير)

### 6. تعديل `StudentDashboard.tsx`

إضافة `<StudentXpCard />` بعد Welcome card مباشرة

### 7. تعديل `StudentProfile.tsx`

إضافة section/tab "XP History" يعرض:
- جدول XP breakdown per level
- إجمالي + Rank لكل مستوى

## ملخص الملفات

| الملف | التعديل |
|-------|---------|
| Migration 1 | Schema: `level_id` + unique + index |
| Migration 2 | 5 triggers (3 تعديل + 2 جديد) + backfill |
| Migration 3 | RPC `get_student_level_xp` |
| `src/components/dashboard/StudentXpCard.tsx` | **جديد** |
| `src/components/dashboard/StudentDashboard.tsx` | إضافة XP Card |
| `src/pages/StudentProfile.tsx` | إضافة XP section |

