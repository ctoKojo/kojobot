

# خطة التنفيذ النهائية - 3 تحسينات

## 1. منع تكرار تسجيل الحضور (Insert Only + فلترة UI)

### A. Backend - تعديل RPC `save_attendance` (Migration)

تعديل الـ loop داخل `save_attendance` ليتحقق قبل كل INSERT:
- لو `session_id + student_id` موجودين بالفعل في `attendance`، يتخطى هذا الطالب ويضيفه لقائمة `rejected_students`
- الطلاب الجدد فقط يتم عمل INSERT لهم (بدون ON CONFLICT DO UPDATE)
- التعويضات تتطبق فقط على الطلاب اللي اتعمل لهم insert
- الرد يرجع: `inserted_count`, `rejected_count`, `rejected_students` (array of student_ids مع سبب `duplicate`)

التغيير الأساسي في الكود:
```text
-- قبل INSERT لكل طالب:
IF EXISTS (SELECT 1 FROM attendance WHERE session_id = p_session_id AND student_id = v_student_id) THEN
  -- أضف للقائمة المرفوضة
  v_rejected := v_rejected || jsonb_build_object('student_id', v_student_id, 'reason', 'duplicate');
  v_rejected_count := v_rejected_count + 1;
  CONTINUE;  -- تخطى هذا الطالب
END IF;
-- INSERT بدون ON CONFLICT
INSERT INTO attendance (...) VALUES (...);
```

- إزالة كل الـ `ON CONFLICT ... DO UPDATE` من الـ INSERT statements
- الاحتفاظ بمنطق auto-confirm instructor و auto-complete session كما هو

### B. Frontend - تعديل `src/pages/SessionDetails.tsx`

**1. حساب حالة الحضور:**
- `studentsWithAttendance` = الطلاب اللي عندهم `attendance_status !== null` (وجود row)
- `totalSessionStudents` = عدد `attendanceStudents` (الطلاب المتاحين للسيشن)
- `attendanceComplete` = `studentsWithAttendance === totalSessionStudents`

**2. الزر (3 حالات):**
- `studentsWithAttendance === 0`: زر "تسجيل الحضور" عادي
- `0 < studentsWithAttendance < totalSessionStudents`: زر "إكمال تسجيل الحضور" بلون outline/orange
- `attendanceComplete`: بادج "تم تسجيل الحضور" (CheckCircle) + الزر disabled

**3. الدايلوج:**
- `openAttendanceDialog` يفلتر `attendanceStudents` ليعرض فقط الطلاب اللي `attendance_status === null`
- كل طالب يبدأ بقيمة فارغة (بدون default)
- منع الحفظ: لو فيه طالب واحد بدون اختيار، الزر disabled + رسالة تحذير
- Select placeholder: "اختر الحالة" / "Select status"
- أزرار "الكل حاضر / الكل غائب" تعمل فقط على المعروضين

**4. بعد الحفظ:**
- لو الرد فيه `rejected_count > 0`، يظهر toast تحذيري يوضح عدد الطلاب المرفوضين

---

## 2. تنظيم صفحة الواجبات (Assignments)

### تعديل `src/pages/Assignments.tsx`

**Query:**
- تعديل استعلام `assignments` ليشمل join مع `sessions` للحصول على `session_number` و `group_id`:
```text
supabase.from('assignments')
  .select('*, sessions(session_number, group_id)')
  .order('due_date', { ascending: false })
```
- ملاحظة: `session_id` ممكن يكون null، فالـ join اختياري (left join تلقائي)

**State جديد:**
- `selectedGroupId: string` (فلتر المجموعة)

**UI:**
- إضافة dropdown فلتر للمجموعات بجانب البحث
- الفلترة: حسب `group_id` المختار (من session أو من assignment.group_id مباشرة)
- الواجبات بدون `session_id` أو بدون `group_id` تظهر تحت مجموعة "بدون مجموعة" / "No Group"
- تجميع بصري: لكل مجموعة عنوان (`CardTitle`) ثم جدول/كروت
- إضافة عمود "رقم السيشن" في الجدول (يظهر `-` لو مفيش session)
- ترتيب داخل كل مجموعة حسب `due_date DESC`

---

## 3. ملخص مالي وأكاديمي مفصل في بروفايل الطالب

### A. تعديل `src/pages/StudentProfile.tsx`
- تمرير `subscription` و `attendance` كـ props لـ `PaymentsHistory`:
```text
<PaymentsHistory
  studentId={studentId!}
  subscription={data.subscription}
  attendance={data.attendance}
/>
```

### B. تعديل `src/components/student/PaymentsHistory.tsx`

**Props جديدة:**
```text
interface Props {
  studentId: string;
  subscription?: any;
  attendance?: any[];
}
```

**1. كروت ملخص (فوق الجدول) - 6 كروت:**
- إجمالي التعاقد (`subscription.total_amount`)
- المدفوع: **محسوب من payments** (`payments.reduce((sum, p) => sum + p.amount, 0)`)
- المتبقي: `total_amount - calculatedPaid`
- بداية الاشتراك (`subscription.start_date`) ونهاية الاشتراك (`subscription.end_date`)
- آخر دفعة (مبلغ + تاريخ) من أول عنصر في payments (مرتبة DESC)
- حالة الاشتراك (active/suspended/expired)

**2. ربط أكاديمي (كروت إضافية):**
- السيشنات المكتملة: `attendance.filter(a => a.status === 'present' || a.status === 'late').length`
- السيشنات المتبقية: `Math.max(0, 12 - completedCount)`

**3. جدول الدفعات (تحسين الحالي):**
- تعديل الـ query ليشمل `recorded_by` مع join على `profiles`:
```text
supabase.from('payments')
  .select('*, profiles!payments_recorded_by_fkey(full_name, full_name_ar)')
```
- ملاحظة: لازم نتأكد من وجود FK relationship. لو مفيش، نستخدم query منفصل أو نعرض `recorded_by` كـ ID فقط
- إضافة عمود "مسجل بواسطة"

**4. جدول المستحقات المحسوب (client-side):**
- تقسيم `total_amount` على 12 سيشن
- أول 11 سيشن: `Math.floor(total_amount / 12)` (أو round to 2 decimals)
- آخر سيشن: `total_amount - (perSession * 11)` عشان المجموع يطلع مضبوط
- توزيع الدفعات بالتسلسل من payments المؤكدة (مرتبة ASC بالتاريخ)
- لكل سطر: رقم السيشن، المستحق، المدفوع المغطى، المتبقي، الحالة (مكتمل/جزئي/غير مدفوع)
- تمييز بصري: السيشنات المكتملة (من attendance) تظهر بلون أخضر خفيف في الخلفية

**5. Unit Test لحساب المستحقات:**
- ملف جديد `src/lib/receivablesCalculator.ts` يحتوي على الدالة البحتة
- ملف جديد `src/lib/receivablesCalculator.test.ts` يختبر:
  - تقسيم مبلغ يقبل القسمة على 12
  - تقسيم مبلغ لا يقبل القسمة (rounding)
  - توزيع دفعة واحدة كاملة
  - توزيع دفعة جزئية
  - توزيع دفعات متعددة
  - حالة بدون دفعات
  - مجموع المستحقات يساوي الإجمالي دائما

---

## الملفات المتأثرة

1. **Migration SQL** - تعديل `save_attendance` RPC (insert only + skip duplicates + return rejected)
2. **`src/pages/SessionDetails.tsx`** - زر حضور ديناميكي (3 حالات) + فلترة الدايلوج + placeholder فارغ + منع الحفظ
3. **`src/pages/Assignments.tsx`** - فلتر مجموعة + join sessions + تجميع بصري + عمود session_number + ترتيب due_date DESC
4. **`src/components/student/PaymentsHistory.tsx`** - كروت ملخص + تواريخ اشتراك + جدول مستحقات + عمود recorded_by + ربط أكاديمي
5. **`src/pages/StudentProfile.tsx`** - تمرير subscription و attendance كـ props
6. **`src/lib/receivablesCalculator.ts`** - دالة حساب المستحقات (جديد)
7. **`src/lib/receivablesCalculator.test.ts`** - unit tests للحساب (جديد)
