

# اعادة ترتيب صفحة بروفايل الطالب - Action-First Layout

## الهدف
رفع التابات (الدفعات/الحضور/الانذارات...) لتكون مباشرة بعد الاحصائيات السريعة، ونقل الكروت المرجعية (المجموعة/المستويات/الرسوم) للاسفل.

## ملف واحد: `src/pages/StudentProfile.tsx`

### التعديلات بالترتيب:

**1. نقل بلوك التابات (سطر 548-882) ليكون مباشرة بعد بطاقات الاحصائيات السريعة (بعد سطر 494)**

الترتيب الجديد للصفحة:
```text
1. Header + ازرار الاكشن        (بدون تغيير)
2. بطاقة البروفايل              (بدون تغيير)
3. بطاقات الاحصائيات السريعة     (بدون تغيير)
4. التابات                      (تتنقل لفوق)
5. بطاقة المجموعة               (تنزل تحت)
6. LevelHistorySection           (تنزل تحت)
7. EvaluationSummary             (تنزل تحت)
8. StudentPerformanceCharts      (اخر حاجة - الاثقل)
```

**2. تغيير `defaultValue` من `"attendance"` الى `"payments"`**
- تم التحقق: الصفحة متاحة لـ admin, instructor, reception - وكلهم يشوفوا تاب الدفعات بدون قيود

**3. اعادة ترتيب TabsTrigger داخل TabsList:**
```text
الترتيب القديم: Attendance, Payments, Quizzes, Assignments, Makeup, Warnings
الترتيب الجديد: Payments, Attendance, Warnings, Quizzes, Assignments, Makeup
```

**4. اعادة ترتيب TabsContent blocks لتطابق الترتيب الجديد:**
- Payments اولا
- Attendance
- Warnings
- Quizzes
- Assignments
- Makeup

## ملاحظات فنية
- لا تغيير في grid او spacing - نفس الـ classes محفوظة
- لا sticky headers في الصفحة الحالية فلا مشاكل
- TabsContent ترتيبها مش مطلوب تقنيا من Radix لكن بنعمله للوضوح في الكود
- StudentPerformanceCharts اخر عنصر = تحسين اداء لان المستخدم نادرا يوصل له
