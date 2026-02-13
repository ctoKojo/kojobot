

# تتبع حضور المدرب التلقائي + إكمال السيشن تلقائياً

## الفكرة

بدل ما الادمن يسجل حضور المدرب يدوي لكل سيشن، النظام هيكتشف تلقائي إن المدرب حضر بناء على نشاطه (تسجيل حضور طلاب، رفع كويز، رفع واجب، إلخ). مع الاحتفاظ بإمكانية التعديل اليدوي للادمن والريسيبشن.

---

## التغييرات المطلوبة

### 1. تعديل `src/pages/SessionDetails.tsx` - الحضور التلقائي للمدرب

**المنطق:** عند حفظ أي نشاط مرتبط بالسيشن (حضور طلاب، كويز، واجب)، النظام يتحقق:
- هل المستخدم الحالي هو مدرب المجموعة؟
- هل يوجد سجل حضور مدرب لهذه السيشن بالفعل؟
- إذا لا، يتم إنشاء سجل تلقائي بحالة `confirmed` وعدد ساعات = `duration_minutes / 60`

**الأماكن المتأثرة في الملف:**
- `handleSaveAttendance` (حفظ حضور الطلاب) - بعد الحفظ الناجح، يتم استدعاء دالة الحضور التلقائي
- `handleImportQuiz` (إضافة كويز) - نفس المنطق
- `handleSaveAssignment` (إنشاء/تعديل واجب) - نفس المنطق

**دالة جديدة `autoConfirmInstructorAttendance`:**
- تتحقق إن المستخدم الحالي هو مدرب المجموعة
- تتحقق إن مفيش سجل حضور مدرب موجود أصلا (عشان ما نعملش override لقرار الادمن)
- لو مفيش، تعمل insert بحالة `confirmed` وساعات = `duration_minutes / 60`

### 2. تعديل `src/pages/SessionDetails.tsx` - إكمال السيشن تلقائياً

**الوضع الحالي:** فيه بالفعل `checkAndUpdateSessionStatus` اللي بيحول السيشن لـ `completed` لما الوقت يعدي. ده شغال.

**التحسين:** عند تأكيد حضور المدرب التلقائي، لو السيشن لسه `scheduled` ووقتها عدى، يتم تحويلها لـ `completed` تلقائياً أيضاً.

### 3. تعديل `src/pages/Attendance.tsx` - نفس المنطق من صفحة الحضور

**المنطق:** عند حفظ الحضور من صفحة Attendance المستقلة، نفس الخطوة:
- لو المستخدم مدرب ومدرب المجموعة = المستخدم الحالي
- أنشئ سجل حضور مدرب تلقائي إن مكانش موجود

### 4. عدد الساعات الفعلية

**المنطق:** `actual_hours` يتحسب تلقائي من `duration_minutes` بتاعة السيشن (اللي اتحددت عند إنشاء المجموعة):
- `actual_hours = session.duration_minutes / 60`
- الادمن والريسيبشن يقدروا يعدلوا العدد يدوي من صفحة تفاصيل السيشن (موجود بالفعل)

### 5. الاحتفاظ بالتحكم اليدوي

- قسم حضور المدرب في `SessionDetails` يفضل موجود زي ما هو
- الادمن والريسيبشن يقدروا يغيروا الحالة (confirmed/absent/inferred) والساعات يدوي
- لو الادمن عدل الحالة لـ `absent`، الحضور التلقائي مش هيعمل override (لأنه بيتحقق إن مفيش سجل أصلا قبل ما يضيف)

---

## التفاصيل التقنية

### دالة `autoConfirmInstructorAttendance` الجديدة (في SessionDetails.tsx)

```text
async function autoConfirmInstructorAttendance():
  1. if user.id !== group.instructor_id -> return (مش المدرب)
  2. if session.status === 'cancelled' -> return
  3. check session_staff_attendance for (session_id, staff_id)
  4. if record exists -> return (مش هنعمل override)
  5. INSERT { session_id, staff_id, status: 'confirmed', actual_hours: duration_minutes/60 }
  6. if session time has passed AND status === 'scheduled':
     UPDATE session SET status = 'completed'
  7. refresh data
```

### نقاط الاستدعاء

| الدالة | الملف | متى |
|--------|-------|------|
| handleSaveAttendance | SessionDetails.tsx | بعد حفظ حضور الطلاب بنجاح |
| handleImportQuiz | SessionDetails.tsx | بعد إضافة كويز بنجاح |
| handleSaveAssignment | SessionDetails.tsx | بعد إنشاء/تعديل واجب بنجاح |
| saveAttendance | Attendance.tsx | بعد حفظ الحضور بنجاح |

### لا تغييرات على قاعدة البيانات

الجدول `session_staff_attendance` موجود بالفعل بكل الأعمدة المطلوبة والـ RLS policies صحيحة.

---

## الملفات المتأثرة

1. `src/pages/SessionDetails.tsx` - إضافة دالة الحضور التلقائي + استدعائها من 3 أماكن + تحسين auto-complete
2. `src/pages/Attendance.tsx` - إضافة نفس المنطق عند حفظ الحضور

