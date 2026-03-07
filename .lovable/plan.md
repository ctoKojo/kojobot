


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

---

## ✅ تم التنفيذ: عرض التوقيت المحلي + مرجع القاهرة (Dual Timezone Display)

### ما تم تنفيذه:
1. **دوال جديدة في `src/lib/timeUtils.ts`**:
   - `getUserTimezone()` — IANA timezone detection مع fallback لـ Africa/Cairo
   - `isCairoTimezone()` — مقارنة مباشرة مع Africa/Cairo
   - `formatSessionTimeForViewer(sessionDate, sessionTime, isRTL)` — بناء Date صحيح باستخدام `fromZonedTime` من `date-fns-tz` (يعامل sessionTime كوقت محلي في القاهرة)
   - `formatSessionDateTimeForViewer(sessionDate, sessionTime, isRTL)` — نفس المنطق مع التاريخ

2. **كومبوننت مركزي `src/components/shared/SessionTimeDisplay.tsx`**:
   - مصر: وقت واحد فقط
   - برا مصر Desktop: `10:00 AM (3:00 PM Cairo)`
   - برا مصر Mobile: سطرين
   - Props: `sessionDate`, `sessionTime`, `isRTL`, `showCairoReference?`, `className?`
   - Graceful fallback لو البيانات ناقصة

3. **استبدال `formatTime12Hour` في 10 ملفات**:
   - Sessions.tsx (4 أماكن)
   - GroupDetails.tsx (3 أماكن)
   - SessionDetails.tsx (1 مكان)
   - Groups.tsx (2 مكان)
   - InstructorProfile.tsx (3 أماكن)
   - StudentDashboard.tsx (3 أماكن)
   - InstructorDashboard.tsx (1 مكان)
   - RescheduleDialog.tsx (1 مكان)
   - WeeklyScheduleGrid.tsx (1 مكان)
   - MakeupSessions.tsx (2 مكان — كانت raw بدون formatting)

4. **`formatTime12Hour` محفوظة** كـ fallback لأماكن مش مرتبطة بسيشن

### ملاحظات تقنية:
- `fromZonedTime` من `date-fns-tz@3.2.0` يستخدم لبناء Date من أرقام محلية في Cairo ← UTC Date صحيح
- لا يستخدم `new Date(string)` parsing مباشر
- الأماكن اللي فيها `schedule_time` بدون `sessionDate` بتمرر `getCairoToday()` كـ approximation
