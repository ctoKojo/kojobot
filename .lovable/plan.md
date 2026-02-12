

# نظام تصنيف الموظفين المتقدم (بارت تايم / فول تايم / متدرب بمقابل)

## الوضع الحالي
حالياً عندك حقل `employment_status` في جدول `profiles` كـ enum بقيمتين فقط: `permanent` و `training`. ده محدود ومش بيغطي الحالات الجديدة.

## التعديلات المطلوبة

### 1. تعديل قاعدة البيانات (Migration)

**إضافة أعمدة جديدة في جدول `profiles`:**

| العمود | النوع | الوصف |
|--------|-------|-------|
| `work_type` | text (default: 'full_time') | نوع العمل: full_time / part_time |
| `is_paid_trainee` | boolean (default: false) | لو متدرب، هل بمقابل؟ (يظهر فقط لما employment_status = training) |
| `hourly_rate` | numeric (nullable) | سعر الساعة (يظهر فقط لو is_paid_trainee = true) |

**ليه أعمدة في `profiles` وليس جدول منفصل؟**
لأن البيانات دي خاصة بالموظف مباشرة ومش محتاجة تاريخ تغييرات (الراتب الشهري هيكون في `employee_salaries` اللي هنعملها لاحقاً).

### 2. تعديل صفحة المدربين (`Instructors.tsx`)

**في فورم الإنشاء/التعديل:**
- إضافة اختيار **نوع العمل**: فول تايم / بارت تايم (radio buttons)
- لو `employment_status = training`: يظهر سؤال **"بمقابل؟"** (switch/checkbox)
- لو **بمقابل = نعم**: يظهر حقل **سعر الساعة** (input رقمي)

**في الجدول والكارد:**
- إضافة badge لـ Full-time (أزرق) / Part-time (بنفسجي)
- لو متدرب بمقابل: badge "Paid Trainee" (أخضر فاتح) مع سعر الساعة

### 3. تعديل Edge Function (`create-user`)
- إضافة الحقول الجديدة (`work_type`, `is_paid_trainee`, `hourly_rate`) في الـ request والـ profile creation

### 4. تعديل بروفايل المدرب (`InstructorProfile.tsx`)
- عرض نوع العمل وحالة التدريب وسعر الساعة في معلومات المدرب

### 5. منطق حساب المقابل للمتدرب (للاستخدام لاحقاً مع نظام الرواتب)

```text
المبلغ المستحق = عدد الساعات (من السيشنات المكتملة) x سعر الساعة

مثال: متدرب سعر ساعته 100 ج.م
- نزل 4 سيشنات x ساعتين = 8 ساعات
- المستحق = 800 ج.م
```

هذا الحساب سيتم دمجه لاحقاً مع نظام الرواتب (`salary_payments`) عند تنفيذه.

---

## ترتيب التنفيذ

1. **Migration**: إضافة أعمدة `work_type`, `is_paid_trainee`, `hourly_rate` في `profiles`
2. **تعديل `Instructors.tsx`**: الفورم + العرض (badges جديدة)
3. **تعديل `create-user` Edge Function**: دعم الحقول الجديدة
4. **تعديل `InstructorProfile.tsx`**: عرض البيانات الجديدة

## الملفات المتأثرة

| الملف | التعديل |
|-------|---------|
| Migration جديد | إضافة 3 أعمدة في profiles |
| `src/pages/Instructors.tsx` | فورم + جدول + كارد |
| `supabase/functions/create-user/index.ts` | حقول جديدة |
| `src/pages/InstructorProfile.tsx` | عرض البيانات |

