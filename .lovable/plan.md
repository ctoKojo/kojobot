
# خطة اختبار وإصلاح نظام تقدم المستوى End-to-End

## المشاكل المكتشفة

### 1. بيانات `group_student_progress` فارغة للطلاب الحاليين
الـ trigger `trg_auto_create_student_progress` يعمل فقط على INSERT جديد في `group_students`. الطلاب الموجودين بالفعل (3 طلاب في مجموعة "يؤسبر") ليس لديهم سجلات progress.

**الحل:** اضافة backfill SQL في migration جديدة تنشئ سجلات progress لكل الطلاب الحاليين في المجموعات النشطة.

### 2. الامتحان النهائي لـ Level 0 موجود لكن بدون أسئلة
الكويز `94888d67-...` (Final Exam - Level 0) تم إنشاؤه لكن يحتوي على 0 أسئلة - لا يمكن اختباره بدون اضافة أسئلة.

**الحل:** لا يحتاج تعديل كود - يحتاج اضافة أسئلة من واجهة Quiz Editor. لكن لأغراض الاختبار سنضيف أسئلة تجريبية عبر SQL.

### 3. الطالب Omar Youssef حضر سيشن واحدة فقط من 12
المطلوب 12 سيشن مكتملة لتأهل الامتحان. الطالب حضر سيشن واحدة فقط (session 9).

**الحل:** لأغراض الاختبار: تقليل `expected_sessions_count` مؤقتا لـ Level 0 إلى 1، أو اضافة سجلات حضور للسيشنات المكتملة.

### 4. `schedule_makeup_session` RPC لا يضيف `level_id`
خطة التنفيذ ذكرت تعديل هذا الـ RPC لكن لم يتم في الكود.

---

## خطة الإصلاح والاختبار

### الخطوة 1: Migration لـ Backfill بيانات Progress
```sql
-- اضافة سجلات progress لكل الطلاب الحاليين في مجموعات نشطة بدأت
INSERT INTO group_student_progress (group_id, student_id, current_level_id)
SELECT gs.group_id, gs.student_id, g.level_id
FROM group_students gs
JOIN groups g ON g.id = gs.group_id
WHERE gs.is_active = true
  AND g.has_started = true
  AND g.level_id IS NOT NULL
ON CONFLICT (group_id, student_id) DO NOTHING;
```

### الخطوة 2: اضافة حضور تجريبي وأسئلة للامتحان
لتمكين الاختبار الكامل:
- اضافة سجلات حضور (present) للطلاب الثلاثة في جميع السيشنات المكتملة (8 سيشنات)
- تقليل `expected_sessions_count` لـ Level 0 مؤقتا أو الابقاء على 12 واضافة المزيد من الحضور
- اضافة أسئلة تجريبية (3-5 أسئلة MCQ) للكويز النهائي

### الخطوة 3: اضافة session evaluations تجريبية
- اضافة تقييمات (session_evaluations) للطلاب في السيشنات المكتملة لحساب evaluation_avg

### الخطوة 4: تعديل `schedule_makeup_session` RPC
اضافة `level_id` عند إنشاء سيشن تعويضية (كان مذكور في الخطة لكن لم ينفذ).

### الخطوة 5: اختبار E2E عبر المتصفح
1. فتح `/levels` - التحقق من عرض الامتحانات والـ pass threshold
2. فتح `/group/:id` - tab "Level Progress" - التحقق من عرض الطلاب مع حالاتهم
3. الضغط على "Schedule Final Exam" - جدولة الامتحان
4. التحقق من تحديث حالات الطلاب لـ `exam_scheduled`
5. محاكاة تسليم الامتحان (عبر SQL أو من واجهة الطالب)
6. الضغط على "Compute Final Grades" - حساب الدرجات
7. التحقق من النتائج (passed/failed)
8. ترقية الطلاب الناجحين - "Upgrade"
9. التحقق من سجل المستويات في StudentProfile

---

## التغييرات التقنية

| الملف | التغيير |
|-------|---------|
| Migration SQL جديدة | Backfill `group_student_progress` + اضافة أسئلة تجريبية + حضور + تقييمات |
| `schedule_makeup_session` RPC | اضافة `level_id` من السيشن الأصلية |

## ملاحظات
- الكود الحالي للواجهة (LevelProgressTab, LevelHistorySection, CurrentLevelStatus) يبدو صحيح معماريا
- المشكلة الأساسية هي غياب البيانات (backfill) مش في الكود نفسه
- بعد الـ backfill، الـ tab هيعرض الطلاب بحالة `in_progress` وهيشتغل الـ workflow بالكامل
