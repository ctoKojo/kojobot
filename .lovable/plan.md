# خطة إعادة بناء نظام Placement Exam V2

---

## ✅ Phase 1: Database Schema (مكتمل)

### الجداول الجديدة:

| الجدول | الوصف |
|--------|-------|
| `placement_v2_settings` | إعدادات عامة (singleton) — thresholds + question counts |
| `placement_v2_questions` | بنك أسئلة بـ sections (section_a, section_b, section_c) + review_status + is_archived |
| `placement_v2_schedules` | جدولة امتحانات مع validation trigger (opens_at < closes_at, no past) |
| `placement_v2_attempts` | محاولات بـ section scores + recommended_level_id → levels + confidence_level |
| `placement_v2_attempt_questions` | أسئلة المحاولة مع section_skill |
| `placement_v2_student_view` | View آمن (security_invoker) للطلاب |

### Level Mapping:
- `level_order = 0` → Level 0 (id: `4c8f5b5e-...`)
- `level_order = 1` → Level 1 (id: `5d2db847-...`)
- `level_order = 2, track = 'software'` → Level 2 Software (id: `8bd4e5ca-...`)
- `level_order = 2, track = 'hardware'` → Level 2 Hardware (id: `b598ef9b-...`)

### Confidence Logic (compute_placement_v2_confidence):
```
margin_a = |section_a_pct - pass_threshold_a|
margin_b = |section_b_pct - pass_threshold_b|
track_diff = |sw_pct - hw_pct|

LOW إذا:
  - تناقض: نجح B لكن رسب A
  - أي section قريب من الحد (≤ 5%)

HIGH إذا:
  - margin_a > 10% AND margin_b > 10%
  - AND (لم يصل Section C، أو track_diff > 2 * track_margin)

MEDIUM: كل ما عدا ذلك
```

### Balanced Logic:
- `recommended_track = 'balanced'` → `recommended_level_id = NULL` + `needs_manual_review = true`

### Functions:
- `update_v2_question_stats()` — تحديث إحصائيات الأسئلة ذرياً
- `validate_placement_v2_schedule()` — trigger (opens_at < closes_at, opens_at > now(), closes_at > now())
- `compute_placement_v2_confidence()` — دالة IMMUTABLE لحساب confidence level

### RLS Policies:
- Admin: full access على كل الجداول
- Reception: manage schedules
- Students: **SELECT فقط** على attempts و attempt_questions (الإنشاء عبر Edge Function)

### Constraints:
- `idx_one_in_progress_per_student` — partial unique index يمنع أكثر من attempt واحدة in_progress لنفس الطالب
- Student View تخفي النتيجة حتى يتم الاعتماد أو تكون needs_manual_review = false

---

## ✅ إصلاح فصل content_number عن session_number (مكتمل)

### التغييرات المنفذة:

#### 1. تريجر `auto_generate_next_session` (Migration)
- عند `academy_closure`: السيشن البديلة ترث `content_number` من الملغية
- عند `completed` أو إلغاء عادي: `content_number` يتقدم +1
- حماية: لا يتم إنشاء سيشن بمحتوى يتجاوز `expected_sessions_count` (ما عدا owed)

#### 2. Edge Functions
- `start-group`: يضع `content_number = session_number` لكل سيشن عند البدء
- `generate-sessions`: يحسب `content_number` من أعلى completed content_number + 1

#### 3. الواجهات
- `Sessions.tsx`: يعرض `content_number` كرقم رئيسي، `session_number` ثانوي عند الاختلاف
- `GroupDetails.tsx`: نفس المنطق في تاب الحضور وتاب الجلسات
- `SessionDetails.tsx`: العنوان يعرض `content_number`
- `EditSessionDialog.tsx`: العنوان يعرض `session_number`

### بقي: إصلاح Live Data
راجع السكربتات أسفل هذا الملف.

---

## 🔲 Phase 2: Edge Functions

### مطلوب بناؤه:
1. `draw-placement-exam` الجديد → سحب أسئلة حسب section counts من settings
2. `grade-placement-exam` الجديد → منطق التسكين الجديد مع confidence logic
3. `import-question-bank` الجديد → validation صارم على section + track_category + options

### مطلوب حذفه لاحقاً (بعد نجاح V2):
- `grade-placement-test`
- `expire-placement-tests`

---

## 🔲 Phase 3: Frontend — إعدادات الأدمن

1. `PlacementTestSettings.tsx` → 3 tabs فقط: General, Question Bank, Review Queue
2. `GeneralSettingsTab.tsx` → إعدادات singleton (thresholds + counts)
3. `QuestionBankTab.tsx` → sections بدل foundation/intermediate/advanced
4. `QuestionEditDialog.tsx` → sections + track_category + review_status
5. `ImportPreviewDialog.tsx` → validation جديد

---

## 🔲 Phase 4: Frontend — تجربة الطالب

1. `PlacementGate.tsx` → جدول placement_v2_schedules
2. `TakePlacementTest.tsx` → 3 sections مع section headers
3. `PlacementExamHeader.tsx` → section indicator
4. `SchedulePlacementDialog.tsx` → جدول جديد

---

## 🔲 Phase 5: Frontend — مراجعة الأدمن

1. `PlacementTestReview.tsx` → per-section scores + track recommendation
2. `PlacementAttemptDetailDialog.tsx` → بريفيو per-section
3. `ReviewQueueTab.tsx` → needs_manual_review filter

---

## 🔲 Phase 6: تنظيف (بعد نجاح V2)

### حذف جداول قديمة:
- `placement_question_bank`, `placement_exam_attempt_questions`, `placement_exam_attempts`
- `placement_exam_schedules`, `placement_exam_settings`, `placement_skill_blueprint`
- `placement_rules`, `placement_exam_student_view`
- `placement_tests`, `placement_test_results`, `placement_question_levels`, `placement_quiz_config`

### حذف Edge Functions قديمة:
- `grade-placement-test`, `expire-placement-tests`

### حذف/إعادة بناء ملفات Frontend:
- `BlueprintTab.tsx`, `PlacementRulesTab.tsx` → حذف نهائي

---

## ملاحظات مهمة

- النظام القديم يبقى حتى نجاح V2 واختباره
- Question counts تُقرأ من settings وليست hardcoded
- Level mapping عبر `level_order` و `track` من جدول `levels`
- balanced → `recommended_level_id = NULL` + `needs_manual_review = true`
