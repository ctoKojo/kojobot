
# إضافة رول "ريسيبشن" - خطة التنفيذ النهائية (Production Grade)

## ملخص
إضافة دور موظف استقبال بصلاحيات تشغيلية كاملة لإدارة الطلاب والمجموعات والاشتراكات والحضور، مع حماية على مستوى قاعدة البيانات ضد الأخطاء البشرية والتلاعب.

---

## جدول الصلاحيات النهائي

| الصفحة | الصلاحية | حماية إضافية |
|--------|---------|-------------|
| الطلاب | إضافة + تعديل (بدون حذف) | حذف للأدمن فقط عبر RLS |
| المجموعات | إضافة + تعديل + بدء (بدون حذف) | حذف للأدمن فقط عبر RLS |
| الجلسات | إدارة كاملة | RLS يمنع تعديل sessions بحالة completed |
| الحضور | تسجيل حضور كامل | RLS يمنع تعديل حضور sessions المكتملة |
| السيشنات التعويضية | إنشاء وإدارة | |
| المصروفات | عرض + إضافة فقط | بدون تعديل أو حذف عبر RLS |
| الاشتراكات والمدفوعات | تسجيل اشتراكات + دفعات | |
| خطط التسعير | عرض فقط | RLS يمنع INSERT/UPDATE/DELETE |
| جدول عمله | عرض فقط | |
| إنذاراته | عرض فقط | |
| البروفايل | تعديل بياناته فقط | |
| بروفايل الطلاب | عرض + تعديل | RLS يمنع تعديل بروفايلات الأدمن والمدربين |

**المحجوب بالكامل:** المدربين، الكويزات، الواجبات، المواد التعليمية، الرواتب، صافي الربح، قواعد الخصم، الفئات العمرية، المستويات، سجل النشاط، الإعدادات، إنذارات المدربين.

---

## التفاصيل التقنية

### 1. Database Migration

**Enum + Helper Functions:**
```sql
-- Add reception to enum
ALTER TYPE public.app_role ADD VALUE 'reception';

-- Helper: check if a user is a student
CREATE OR REPLACE FUNCTION public.is_student(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'student'
  )
$$;
```

**RLS Policies (حسب كل جدول):**

| الجدول | العمليات المسموحة للريسيبشن | ملاحظات |
|--------|--------------------------|---------|
| profiles | SELECT all, INSERT, UPDATE (students + own only) | `is_student(profiles.user_id) OR profiles.user_id = auth.uid()` |
| groups | SELECT, INSERT, UPDATE (no DELETE) | سياسة منفصلة بدون DELETE |
| group_students | SELECT, INSERT, UPDATE (no DELETE) | |
| group_level_progress | SELECT, UPDATE | |
| sessions | SELECT, INSERT, UPDATE (scheduled only) | `status = 'scheduled'` للتعديل |
| attendance | SELECT, INSERT, UPDATE | مع حماية: فقط sessions غير مكتملة |
| makeup_sessions | ALL | |
| subscriptions | ALL | |
| payments | ALL | |
| expenses | SELECT + INSERT فقط | بدون UPDATE/DELETE |
| notifications | SELECT own + INSERT | |
| user_roles | SELECT own فقط | |
| activity_logs | SELECT own + INSERT own | |
| age_groups | SELECT (موجود مسبقا) | مطلوب لإنشاء طلاب |
| levels | SELECT (موجود مسبقا) | مطلوب لإنشاء طلاب |

**Database-Level Locks (حماية على مستوى الداتابيز):**
- سياسة UPDATE على sessions للريسيبشن تشترط `status = 'scheduled'` -- يمنع تعديل sessions مكتملة
- سياسة UPDATE على attendance للريسيبشن تتحقق من session status عبر subquery
- expenses: فقط SELECT + INSERT -- بدون أي UPDATE أو DELETE policy

### 2. تحديث الأنواع والسياقات

**`src/contexts/AuthContext.tsx`:**
- تغيير `AppRole` من `'admin' | 'instructor' | 'student'` إلى `'admin' | 'instructor' | 'student' | 'reception'`

**`src/components/ProtectedRoute.tsx`:**
- تحديث نوع `allowedRoles` ليشمل `'reception'`

### 3. تحديث الـ Sidebar (`src/components/AppSidebar.tsx`)

- تحديث `NavItem.roles` type ليشمل `'reception'`
- إضافة `'reception'` للعناصر التالية:
  - **Main:** Dashboard, Students, Groups, Monthly Reports
  - **Sessions:** Sessions, Attendance, Makeup Sessions
  - **Finance:** Finance (مصروفات + اشتراكات), Pricing Plans
  - إضافة **My Schedule** و **My Warnings** و **Notifications** للريسيبشن

### 4. تحديث Routes (`src/App.tsx`)

إضافة `'reception'` لـ `allowedRoles`:
- `/students`, `/student/:studentId`
- `/groups`, `/group/:groupId`
- `/sessions`, `/session/:sessionId`
- `/attendance`
- `/makeup-sessions`
- `/finance`, `/pricing-plans`
- `/notifications`, `/profile`
- `/monthly-reports`
- `/instructor-schedule` (كموظف يشوف جدوله)

### 5. إنشاء ReceptionDashboard

ملف جديد: `src/components/dashboard/ReceptionDashboard.tsx`

مؤشرات تشغيلية يومية:
- عدد الطلاب النشطين
- عدد المجموعات النشطة
- جلسات اليوم
- طلاب لم يُسجل حضورهم اليوم (sessions اليوم بدون attendance مسجل)
- مدفوعات متأخرة (اشتراكات تجاوزت next_payment_date)
- طلبات سيشن تعويضية معلقة (status = 'pending')

### 6. تحديث Dashboard (`src/pages/Dashboard.tsx`)

- إضافة `case 'reception': return <ReceptionDashboard />`
- إضافة subtitle للريسيبشن: "إدارة العمليات اليومية" / "Manage daily operations"

### 7. Permission Guards على الصفحات

**Students (`src/pages/Students.tsx`):**
- إخفاء زر الحذف (Trash2) وعنصر القائمة المنسدلة "حذف" عندما `role === 'reception'`
- إبقاء إضافة وتعديل كما هي

**Groups (`src/pages/Groups.tsx`):**
- إخفاء زر الحذف وعنصر القائمة المنسدلة "حذف" عندما `role === 'reception'`
- إبقاء إضافة وتعديل وبدء المجموعة

**Finance (`src/pages/Finance.tsx`):**
- عندما `role === 'reception'`: إظهار فقط تبويبات Subscriptions + Payments + Expenses + Reports
- إخفاء: Salaries + Net Profit

**PricingPlans (`src/pages/PricingPlans.tsx`):**
- عندما `role === 'reception'`: إخفاء زر "إضافة خطة" وأزرار التعديل والحذف بالكامل
- عرض الجدول فقط بوضع القراءة

### 8. تحديث Edge Functions

**`create-user/index.ts`:**
- إضافة `'reception'` لنوع الـ role في `CreateUserRequest`
- السماح للريسيبشن بإنشاء حسابات **طلاب فقط**:
```text
if (requesterRole === 'reception' && body.role !== 'student') {
  return 403 - Reception can only create student accounts
}
```
- rate limiting موجود مسبقا (5 requests/minute)

**`delete-users/index.ts`:**
- بدون تغيير -- الحذف يبقى مقيد بالأدمن فقط

### 9. تحديث i18n (`src/lib/i18n.ts`)

- إضافة `reception` في interface `roles`:
```text
roles: { admin, instructor, student, reception }
```
- EN: `reception: 'Reception'`
- AR: `reception: 'ريسيبشن'`

### 10. Activity Logging

- كل عمليات الريسيبشن الحساسة (إنشاء طالب، تعديل اشتراك، تسجيل دفعة) تُسجل تلقائيا عبر `activityLogger.ts` الموجود
- الريسيبشن يرى سجله فقط عبر RLS، الأدمن يرى الكل

### 11. التكامل المالي كموظف

- الريسيبشن يُعامل كموظف لأغراض الرواتب (employee_salaries + salary_payments)
- RLS: SELECT own فقط على salary_payments و employee_salaries
- الأدمن يدير راتبه كأي موظف آخر

---

## ملخص الحمايات على مستوى الداتابيز (ليس فقط UI)

1. **منع الحذف:** لا يوجد DELETE policy للريسيبشن على profiles, groups, group_students, expenses
2. **تقييد profiles:** UPDATE مسموح فقط على بروفايلات الطلاب + بروفايل نفسه (عبر `is_student()`)
3. **قفل Sessions:** UPDATE مسموح فقط عندما `status = 'scheduled'`
4. **قفل المصروفات:** SELECT + INSERT فقط بدون UPDATE أو DELETE
5. **منع تصعيد الصلاحيات:** edge function يمنع الريسيبشن من إنشاء أي حساب غير طالب
6. **سجل النشاط:** INSERT own فقط، SELECT own فقط

---

## الملفات المطلوب إنشاؤها
- `src/components/dashboard/ReceptionDashboard.tsx`

## الملفات المطلوب تعديلها
- SQL Migration جديد (enum + helper function + ~20 RLS policy)
- `src/contexts/AuthContext.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/components/AppSidebar.tsx`
- `src/pages/Dashboard.tsx`
- `src/App.tsx`
- `src/pages/Students.tsx` (إخفاء الحذف)
- `src/pages/Groups.tsx` (إخفاء الحذف)
- `src/pages/Finance.tsx` (تقييد التابات)
- `src/pages/PricingPlans.tsx` (وضع القراءة فقط)
- `src/lib/i18n.ts` (إضافة ترجمة)
- `supabase/functions/create-user/index.ts` (دعم reception + تقييد إنشاء الطلاب فقط)
