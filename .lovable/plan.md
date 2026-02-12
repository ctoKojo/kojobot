

# تحويل صفحة "المدربين" إلى "الموظفين" - خطة التنفيذ النهائية

## ملخص
تحويل صفحة المدربين إلى صفحة شاملة لكل الموظفين (مدربين + ريسيبشن) مع فلترة بالتصنيف وفورم ديناميكي حسب نوع الموظف. التغيير على مستوى العرض فقط بدون تعديل في قاعدة البيانات.

---

## الملفات المطلوب تعديلها

### 1. `src/lib/i18n.ts`

**Interface - توسيع `instructors` section:**

اضافة الحقول التالية:
- `employeesTitle` - عنوان الصفحة الجديد
- `addEmployee` - زر الاضافة
- `editEmployee` - عنوان ديالوج التعديل
- `employeeType` - لابل نوع الموظف
- `allEmployees` - تاب الكل
- `instructorsOnly` - تاب المدربين
- `receptionOnly` - تاب الريسيبشن

**الترجمات:**
- EN: `nav.instructors: 'Employees'`, بالاضافة الى كل الحقول الجديدة
- AR: `nav.instructors: 'الموظفين'`, بالاضافة الى كل الحقول الجديدة

### 2. `src/pages/Instructors.tsx` (التغييرات الرئيسية)

**تحديث Interface (سطر 48-62):**
- اضافة `role: 'instructor' | 'reception'` للـ `Instructor` interface

**اضافة state جديد (بعد سطر 70):**
- `categoryFilter: 'all' | 'instructor' | 'reception'` (default: `'all'`)
- `employee_type: 'instructor' | 'reception'` في formData (default: `'instructor'`)

**تعديل `fetchInstructors` (سطر 132-168):**
- تغيير `.eq('role', 'instructor')` الى `.in('role', ['instructor', 'reception'])`
- جلب `role` مع `user_id` من `user_roles`
- ربط الـ role بكل profile عند الدمج
- ترتيب النتائج حسب `full_name`
- defensive handling: تجاهل profiles بدون match مع تسجيل warning

**اضافة `filteredByCategory` بـ `useMemo` (بعد سطر 360):**
- dependencies: `[filteredInstructors, categoryFilter]`
- فلترة client-side حسب التاب المختار
- استبدال `filteredInstructors` بـ `filteredByCategory` في كل اماكن الـ render

**تعديل `handleSetSalary` (سطر 183):**
- تغيير `employee_type: 'instructor'` الثابت الى `employee_type: salaryTarget.role`

**تعديل `handleSubmit` (سطر 274):**
- تغيير `role: 'instructor'` الثابت الى `role: formData.employee_type`
- عدم ارسال `specialization` لو `employee_type === 'reception'`

**تعديل `resetForm` (سطر 317-334):**
- اضافة `employee_type: 'instructor'` للقيم الافتراضية

**تحديث عنوان الصفحة (سطر 363):**
- من `t.instructors.title` الى `t.instructors.employeesTitle`

**تحديث زر الاضافة (سطر 377-384):**
- من `t.instructors.addInstructor` الى `t.instructors.addEmployee`

**اضافة Category Tabs (بعد سطر 385، قبل الـ Dialog):**
- 3 تابات: الكل / المدربين / الريسيبشن
- استخدام `Tabs` component الموجود

**تعديل الـ Dialog (سطر 388-685):**
- عنوان الديالوج: `editEmployee` / `addEmployee` بدل `editInstructor` / `addInstructor`
- وصف الديالوج: "ادخل بيانات الموظف" بدل "ادخل بيانات المدرب"
- اضافة حقل "نوع الموظف" (radio: مدرب / ريسيبشن) قبل حقل الاسم -- يظهر فقط عند الاضافة (ليس التعديل)
- عند التعديل: عرض badge ثابت لنوع الموظف
- اخفاء حقول التخصص (سطر 562-579) عندما `employee_type === 'reception'`

**تعديل Mobile Cards (سطر 688-803):**
- تغيير empty state من "لا يوجد مدربين" الى "لا يوجد موظفين"
- اضافة badge نوع الموظف (مدرب ازرق / ريسيبشن بنفسجي)
- عرض "-" بدل التخصص لموظفي الريسيبشن
- استبدال `filteredInstructors` بـ `filteredByCategory`

**تعديل Desktop Table (سطر 805-934):**
- اضافة عمود "النوع" بعد عمود الاسم
- تغيير empty state من "لا يوجد مدربين" الى "لا يوجد موظفين"
- عرض "-" بدل التخصص لموظفي الريسيبشن
- استبدال `filteredInstructors` بـ `filteredByCategory`

**تعديل toast messages:**
- "تم تحديث المدرب" -> "تم تحديث الموظف" (سطر 263)
- "تم انشاء المدرب" -> "تم انشاء الموظف" (سطر 297)
- "فشل في تحميل المدربين" -> "فشل في تحميل الموظفين" (سطر 163)
- "فشل في حفظ بيانات المدرب" -> "فشل في حفظ بيانات الموظف" (سطر 310)

### 3. `src/components/AppSidebar.tsx` (سطر 66)

- الترجمة ستتغير تلقائيا لان `t.nav.instructors` سيصبح "Employees" / "الموظفين"
- لا حاجة لتغيير الرابط او الايقونة

### 4. `src/pages/InstructorProfile.tsx`

**Role Detection (اضافة في `fetchInstructorData` -- سطر 80-323):**
- اضافة استعلام لجلب role الموظف من `user_roles` بالتوازي مع باقي الاستعلامات عبر `Promise.all`
- state جديد: `employeeRole: 'instructor' | 'reception' | null`

**Section Config (ثابت خارج الكومبوننت):**

```text
const EMPLOYEE_SECTIONS = {
  instructor: ['reports', 'finance', 'groups', 'sessions', 'quizzes', 'assignments'],
  reception: ['finance'],
} as const;

const DEFAULT_SECTIONS = ['finance']; // fallback
```

**Skip unnecessary fetches:**
- لو `employeeRole === 'reception'`: تخطي جلب groups, quizzes, assignments, attendance, warnings
- تنفيذ الاستعلامات بالتوازي لتقليل latency

**تعديل عنوان الصفحة (سطر 364, 374, 387):**
- من "ملف المدرب" / "Instructor Profile" الى "ملف الموظف" / "Employee Profile"

**تعديل not found message (سطر 376):**
- من "لم يتم العثور على المدرب" الى "لم يتم العثور على الموظف"

**تعديل Badge في الهيدر (سطر 410-411):**
- ديناميكي حسب role: "مدرب" / "ريسيبشن"

**تعديل Quick Stats (سطر 453-510):**
- اخفاء كروت المجموعات/الكويزات/الواجبات لموظفي الريسيبشن
- اختصار الـ grid من 4 اعمدة الى العدد المناسب

**تعديل Warnings Section (سطر 512-561):**
- اخفاء بالكامل لموظفي الريسيبشن

**تعديل Tabs (سطر 564-892):**
- عرض فقط التابات المسموحة حسب `EMPLOYEE_SECTIONS[role]`
- تغيير `grid-cols-6` ديناميكيا حسب عدد التابات المتاحة
- الـ default tab يكون اول تاب متاح

---

## لا حاجة لـ
- Database migration
- تغيير routes فعلية
- Edge function changes
- تغيير `App.tsx` او `ProtectedRoute.tsx`

