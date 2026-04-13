

# خطة: الميزات الناقصة لبوابة ولي الأمر

## ملخص
4 محاور: (1) تابات كويزات + شهادات + ميك أب في ParentStudentView، (2) نظام طلبات إجازة، (3) إشعار غياب فوري لأولياء الأمور، (4) نقل تأكيد/رفض الميك أب من الطالب لولي الأمر.

---

## 1. Database Migration — جدول `leave_requests`

```sql
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  parent_id uuid NOT NULL,
  request_date date NOT NULL,
  end_date date,
  reason text NOT NULL,
  status text DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
```

RLS:
- Parents: SELECT/INSERT/UPDATE own rows (`parent_id = auth.uid()`)
- Admin/Reception: SELECT all + UPDATE status

---

## 2. `ParentStudentView.tsx` — إضافة 3 تابات جديدة

التابات الحالية: حضور، درجات، مدفوعات، اشتراك (4 تابات، grid-cols-4).
**بعد التعديل**: حضور، درجات، كويزات، شهادات، تعويضية، مدفوعات، اشتراك (**7 تابات**، scrollable أو wrapped).

### تاب الكويزات
- جلب من `quiz_submissions` مع join على `quiz_assignments → quizzes` لعرض: اسم الكويز، الدرجة، النسبة، الحالة (ناجح ≥60% / راسب).

### تاب الشهادات
- جلب من `student_certificates` بنفس منطق `StudentCertificatesTab` لكن **بدون** أزرار إعادة توليد/طباعة (read-only + download فقط).

### تاب السيشنات التعويضية
- جلب من `makeup_sessions` للطالب المحدد.
- عرض السيشنات المجدولة مع أزرار **تأكيد/رفض** (نفس منطق `handleConfirm` الموجود حالياً في `MyMakeupSessions.tsx`).
- الإشعار يروح للأدمن باسم ولي الأمر.

### تقرير PDF شهري
- زر "تحميل تقرير" يستخدم `pdfReports.ts` لتوليد ملخص (حضور + درجات + مالي).

---

## 3. `MyMakeupSessions.tsx` — Read-Only للطالب

- إزالة أزرار "تأكيد/رفض" (lines 60-105 تقريباً).
- إضافة رسالة توضيحية: "التأكيد يتم عبر حساب ولي الأمر".
- العرض يبقى كما هو (الطالب يشوف سيشناته التعويضية بدون تفاعل).

---

## 4. `SessionDetails.tsx` — إشعار غياب لأولياء الأمور

بعد نجاح `handleSaveAttendance` (بعد line 968):
- لكل طالب في `attendanceRecords` بحالة `absent`:
  - جلب أولياء أموره من `parent_students`.
  - إرسال إشعار عبر `notificationService.create()` بعنوان "تسجيل غياب" مع اسم الطالب والمجموعة والتاريخ.

---

## 5. صفحة `ParentLeaveRequests.tsx` (جديدة)

- صفحة لولي الأمر لإدارة طلبات الإجازة.
- عرض قائمة الطلبات مع حالاتها (معلق/موافق/مرفوض).
- زر "طلب إجازة جديد" → Dialog: اختيار الابن (من الأبناء المرتبطين)، التاريخ من-إلى، السبب.
- عند الإنشاء: إشعار لكل الأدمن والريسيبشن.

---

## 6. صفحة `LeaveRequests.tsx` (جديدة)

- صفحة للأدمن/الريسيبشن لإدارة كل طلبات الإجازة.
- فلتر بالحالة (الكل/معلق/موافق/مرفوض).
- أزرار موافقة/رفض + حقل ملاحظات.
- عند الرد: إشعار لولي الأمر.

---

## 7. `App.tsx` + `AppSidebar.tsx`

- Routes: `/leave-requests` (admin/reception)، `/parent-leave-requests` (parent).
- Sidebar: إضافة "طلبات الإجازة" للأدمن/الريسيبشن وولي الأمر.

---

## الملفات المتأثرة

| ملف | تغيير |
|---|---|
| Migration جديد | `leave_requests` + RLS |
| `src/pages/ParentStudentView.tsx` | 3 تابات جديدة (كويزات، شهادات، تعويضية) + تقرير PDF |
| `src/pages/MyMakeupSessions.tsx` | إزالة أزرار التأكيد → read-only |
| `src/pages/SessionDetails.tsx` | إشعار غياب لأولياء الأمور بعد حفظ الحضور |
| `src/pages/ParentLeaveRequests.tsx` | **جديد** |
| `src/pages/LeaveRequests.tsx` | **جديد** |
| `src/components/AppSidebar.tsx` | روابط جديدة |
| `src/App.tsx` | Routes جديدة |

