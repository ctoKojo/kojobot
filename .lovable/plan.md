

# خطة تنفيذ نظام امتحان تحديد المستوى

الخطة اللي بعتها مكتملة ومتماسكة. هنفذها كالتالي:

---

## المرحلة 1: Database Migration

4 جداول جديدة مع RLS:
- **`placement_tests`** — حجز الامتحان (الطالب يقرأ بياناته فقط)
- **`placement_test_results`** — النتائج (admin/reception فقط، الطالب ممنوع تماماً)
- **`placement_question_levels`** — ربط كل سؤال بمستوى (admin فقط)
- **`placement_quiz_config`** — ربط كويز بفئة عمرية + pass_threshold (admin فقط)

## المرحلة 2: Edge Functions

- **`grade-placement-test`** — تصحيح أوتوماتيك + حساب المستوى المقترح + إشعار أدمن
- **`expire-placement-tests`** — cron كل 15 دقيقة لتقليب `pending` → `expired`

## المرحلة 3: صفحات جديدة

- **`PlacementTestSettings.tsx`** (`/placement-test-settings`) — إعداد كويز لكل فئة عمرية + ربط أسئلة بمستويات
- **`PlacementTestReview.tsx`** (`/placement-test-review`) — مراجعة النتائج + موافقة/تغيير المستوى + بريفيو إجابات
- **`TakePlacementTest.tsx`** (`/placement-test/:id`) — صفحة أداء الامتحان للطالب (بدون عرض نتيجة)

## المرحلة 4: تعديلات على ملفات موجودة

- **`Students.tsx`** — dialog جدولة امتحان بعد إنشاء طالب جديد
- **`StudentDashboard.tsx`** — بانر يحجب الداشبورد حتى الامتحان والمراجعة
- **`ProtectedRoute.tsx`** — منع دخول routes حساسة بدون `level_id`
- **`AdminDashboard.tsx`** — كارت تنبيه بامتحانات معلقة
- **`AppSidebar.tsx`** — روابط جديدة
- **`App.tsx`** — routes جديدة

---

## ترتيب التنفيذ

نظراً لحجم العمل الكبير، هنفذ على مراحل:
1. DB migration (الأساس)
2. Edge functions (grade + expire)
3. إعدادات الأدمن (PlacementTestSettings)
4. صفحة الامتحان (TakePlacementTest)
5. صفحة المراجعة (PlacementTestReview)
6. تعديل Students.tsx + Dashboard + ProtectedRoute + Sidebar + Routes

