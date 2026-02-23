

# تحسين الداشبوردات -- Dashboard Improvements

## الوضع الحالي والمشاكل

### داشبورد المدرب (InstructorDashboard)
1. **"تسجيل الحضور"** -- يوجه لـ `/attendance` وهو route غير موجود أصلاً (صفحة الحضور محذوفة، الحضور بيتسجل من داخل السيشن)
2. **"إسناد الكويزات"** -- يوجه لـ `/my-instructor-quizzes` لكن الكويزات أصبحت curriculum-first ولا تُسند من صفحة مستقلة
3. **الإنذارات موجودة** في الكود لكن ممكن مش بتظهر لو مفيش إنذارات نشطة -- محتاج نتأكد إن الكارد بيظهر دايماً حتى لو العدد صفر كـ KPI

### داشبورد الطالب (StudentDashboard)
- شغال بشكل جيد لكن ممكن نحسنه

### داشبورد الأدمن (AdminDashboard)
- شغال ومنطقي

### داشبورد الاستقبال (ReceptionDashboard)
- عنده كارد "حضور غير مسجل" يوجه لـ `/attendance` وهو route غير موجود

---

## التغييرات المقترحة

### 1. داشبورد المدرب -- `InstructorDashboard.tsx`

**حذف Quick Actions القديمة:**
- حذف كارد "تسجيل الحضور" (Record Attendance) -- لأن الحضور بيتسجل من السيشن مباشرة
- حذف كارد "إسناد الكويزات" (Quiz Assignments) -- لأن الكويزات أصبحت تُسند من المنهج

**إضافة كارد إنذارات في Stats Grid:**
- إضافة كارد "الإنذارات النشطة" في الـ Stats Grid (بجانب مجموعاتي / الطلاب / السيشنات / التسليمات)
- يظهر العدد دائماً (حتى لو صفر)
- لون تحذيري لو فيه إنذارات نشطة
- كليكابل يوجه لـ `/my-instructor-warnings`

**تحسين Quick Actions البديلة:**
- إضافة كارد "إنذاراتي" → `/my-instructor-warnings`
- إضافة كارد "المنهج" → `/curriculum` (أو حسب الموجود)
- إضافة كارد "جدولي" → `/instructor-schedule`

### 2. داشبورد الاستقبال -- `ReceptionDashboard.tsx`

**تعديل كارد "حضور غير مسجل":**
- تغيير التوجيه من `/attendance` إلى `/sessions` (لأن الحضور يُسجل من داخل السيشن)

---

## التفاصيل التقنية

### الملفات المتأثرة

| الملف | التغيير |
|-------|---------|
| `src/components/dashboard/InstructorDashboard.tsx` | حذف Quick Actions القديمة، إضافة كارد الإنذارات في Stats Grid، إضافة Quick Actions جديدة |
| `src/components/dashboard/ReceptionDashboard.tsx` | تغيير navigate للحضور من `/attendance` إلى `/sessions` |

### تفاصيل InstructorDashboard

**Stats Grid (4 كاردات → 5 كاردات):**
1. مجموعاتي → `/groups` (موجود)
2. إجمالي الطلاب (موجود)
3. السيشنات القادمة → `/sessions` (موجود)
4. تسليمات بانتظار → `/assignments` (موجود)
5. **جديد**: الإنذارات النشطة → `/my-instructor-warnings` (لون أحمر/تحذيري لو > 0)

**Warnings Alert Card:** يبقى كما هو (يظهر تفاصيل الإنذارات لو فيه)

**Quick Actions الجديدة (بدل القديمة):**
- "إنذاراتي" → `/my-instructor-warnings` -- أيقونة AlertTriangle
- "جدولي" → `/instructor-schedule` -- أيقونة Calendar

### تفاصيل ReceptionDashboard

- تغيير `onClick` لكارد "حضور غير مسجل" من `navigate('/attendance')` إلى `navigate('/sessions')`

