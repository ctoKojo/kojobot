
# توحيد نظام الحضور داخل السيشن + اصلاح عرض المحتوى + تنظيف النظام القديم

---

## الخطوة 1: تعديل `SessionDetails.tsx` - استبدال الحضور بـ RPC

### ا. استبدال `handleSaveAttendance` (سطر 821-864)

الكود الحالي بيعمل `delete` + `insert` مباشر على جدول attendance بدون انشاء تعويضيات.

يتحول لاستدعاء `save_attendance` RPC:

```text
const records = Object.entries(attendanceRecords).map(([studentId, status]) => ({
  student_id: studentId,
  status,
  notes: null,
}));

const { data, error } = await supabase.rpc('save_attendance', {
  p_session_id: session.id,
  p_group_id: session.group_id,
  p_records: records,
});
```

بعد النجاح: عرض رسالة تفصيلية من الـ response (عدد السجلات + التعويضيات المنشأة/الملغية + تأكيد حضور المدرب).

### ب. حذف `autoConfirmInstructorAttendance` (سطر 211-258)

الـ RPC `save_attendance` بيعملها تلقائي (بشرط وجود طالب واحد حاضر على الاقل). نحذف الدالة بالكامل ونحذف كل الاستدعاءات ليها:

- سطر 547 (بعد `handleAssignCurriculumQuiz`)
- سطر 595 (بعد `handleAssignCurriculumAssignment`)
- سطر 676 (بعد `handleSaveAssignment`)
- سطر 854 (بعد `handleSaveAttendance` القديمة)

### ج. اضافة مؤشرات التعويضية في attendance dialog

- تعديل `fetchSessionData` (سطر 339-342) لجلب `compensation_status` و `makeup_session_id` مع بيانات الحضور
- تحديث `StudentData` interface لاضافة `compensation_status` و `makeup_session_id`
- عرض badge بجانب كل طالب في الـ attendance dialog:
  - `pending_compensation` -> badge برتقالي "في انتظار التعويض"
  - `compensated` -> badge اخضر "تم التعويض"

### د. عرض محتوى المنهج للطلاب (سطر 1206-1216)

حاليا لو مفيش محتوى: الطالب يشوف `null` (لا شيء). نضيف كارت للطالب:

بدل:
```text
) : null}
```
يبقى:
```text
) : (
  <Card className="border-muted">
    <CardContent className="flex items-center gap-3 py-4">
      <BookOpen className="h-5 w-5 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        {isRTL ? 'لا يوجد محتوى متاح لهذه السيشن' : 'No content available for this session'}
      </p>
    </CardContent>
  </Card>
)}
```

---

## الخطوة 2: حذف صفحة Attendance المنفصلة

### ا. حذف `src/pages/Attendance.tsx` بالكامل

### ب. ازالة Route من `App.tsx` (سطر 88)

حذف:
```text
<Route path="/attendance" element={<ProtectedRoute allowedRoles={['admin', 'instructor', 'student', 'reception']}><Attendance /></ProtectedRoute>} />
```
وحذف الـ import (سطر 27).

### ج. ازالة روابط الـ Sidebar من `AppSidebar.tsx`

حذف رابط `/attendance` من 3 اماكن:
- admin section (سطر ~96 في Academic)
- student section (سطر ~188 في My Learning)
- reception section (سطر ~217 في Operations)

---

## الخطوة 3: Database Migration - فلترة المحتوى للطلاب

تعديل RPC `get_curriculum_with_access` عشان الطلاب يشوفوا published فقط.

بناء على role (مش subscription_type):

```text
CREATE OR REPLACE FUNCTION public.get_curriculum_with_access(...)
-- نفس التوقيع والجسم لكن نضيف شرط:
AND (
  cs.is_published = true
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'instructor'::app_role)
)
```

---

## الملفات المتأثرة

| الملف | نوع التعديل |
|---|---|
| `src/pages/SessionDetails.tsx` | استبدال handleSaveAttendance بـ RPC + حذف autoConfirmInstructorAttendance + مؤشرات تعويضية + عرض محتوى للطلاب |
| `src/pages/Attendance.tsx` | **حذف** |
| `src/App.tsx` | ازالة route + import (سطر 27 و 88) |
| `src/components/AppSidebar.tsx` | ازالة 3 روابط `/attendance` |
| Migration SQL | تعديل `get_curriculum_with_access` لفلترة `is_published` بناء على role |

---

## التفاصيل التقنية

### تعديلات `StudentData` interface

```text
interface StudentData {
  student_id: string;
  student_name: string;
  student_name_ar: string;
  attendance_status: string | null;
  compensation_status: string | null;     // جديد
  makeup_session_id: string | null;        // جديد
  quiz_score: number | null;
  quiz_max_score: number | null;
  quiz_percentage: number | null;
  quiz_status: string | null;
  assignment_score: number | null;
  assignment_max_score: number | null;
  assignment_status: string | null;
}
```

### تعديل fetchSessionData

الـ attendance query الحالي (سطر 339-342):
```text
.select('student_id, status')
```
يبقى:
```text
.select('student_id, status, compensation_status, makeup_session_id')
```

وربط البيانات في `combinedStudents` (سطر 393-412).

### النتيجة

- مسار واحد للحضور: من داخل السيشن فقط
- كل غياب ينشئ تعويضية تلقائيا عبر الـ RPC
- تغيير الغياب لحضور يلغي التعويضية تلقائيا
- حضور المدرب يتسجل تلقائيا داخل نفس العملية
- محتوى المنهج يظهر للطلاب (رسالة واضحة لو مفيش محتوى)
- الطلاب يشوفوا published فقط
- صفر كود مكرر او مسارات متضاربة
