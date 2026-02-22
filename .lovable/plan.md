
# بطاقة هوية الطالب (Student ID Card) - قابلة للطباعة

---

## الملخص

اضافة دالة `generateStudentCard` في `pdfReports.ts` تعتمد على `openPrintWindow` الحالي، وتطبيقها في 3 اماكن مع حماية الباسورد والصلاحيات.

---

## الملفات (4 تعديلات)

| # | الملف | التغيير |
|---|---|---|
| 1 | `src/lib/pdfReports.ts` | اضافة `generateStudentCard` بعد `generateSalarySlip` |
| 2 | `src/components/CredentialsDialog.tsx` | زرار "طباعة البطاقة" في الفوتر (بالباسورد) |
| 3 | `src/pages/Students.tsx` | زرار "بطاقة الطالب" في dropdown الموبايل (سطر 1111) والديسكتوب (سطر 1243) |
| 4 | `src/pages/StudentProfile.tsx` | زرار "بطاقة الطالب" في شريط الازرار العلوي (سطر 294) |

---

## التفاصيل التقنية

### 1. `src/lib/pdfReports.ts` - دالة `generateStudentCard`

**تضاف بعد `generateSalarySlip` (سطر 163) وقبل `generateDataReport`.**

Interface:
```text
interface StudentCardData {
  name: string;
  nameAr?: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  ageGroup?: string;
  level?: string;
  subscriptionType?: string;
  attendanceMode?: string;
  group?: string;
}

interface StudentCardOptions {
  password?: string;
  isRTL: boolean;
}
```

المنطق:
- تستخدم `openPrintWindow` الموجود مع styles مخصصة للكارد تتضاف في الـ content نفسه (inline styles)
- مقاس الكارد: `86mm x 54mm` مع `padding: 2mm` كـ bleed
- Header gradient: `linear-gradient(135deg, #61BAE2, #6455F0)` مع اسم Kojobot وشعار
- صورة دائرية `50px`:
  - لو `avatarUrl` موجود: `<img>` مع `crossorigin="anonymous"` و `onerror` يخفي الصورة ويظهر الـ fallback
  - الـ fallback: `<div>` دائري بلون gradient فيه اول حرف من الاسم (fontsize 20px، ابيض)
  - الحل: الصورة والـ fallback يتعرضوا مع بعض، الـ `onerror` يعمل `this.style.display='none'` والـ fallback يظهر تلقائي (CSS: fallback يظهر لو الصورة hidden)
- الحقول تظهر فقط لو فيها قيمة (كل حقل ملفوف في `${field ? '...' : ''}`)
- ترتيب الحقول: الاسم (عربي + انجليزي لو متاح) -> ايميل -> هاتف -> فئة عمرية -> مستوى -> اشتراك -> حضور -> مجموعة
- الباسورد: لو `password` موجود يظهر في حقل بخلفية `#fff3cd` مميزة
- الصفحة فيها كاردين (نسخة الطالب + نسخة الارشيف) مع label صغير فوق كل كارد
- `direction` يتحدد من `isRTL`
- `line-height: 1.6` على body و card
- CSS:
  - `.student-card { width: 86mm; height: 54mm; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; margin: 10mm auto; }`
  - `@media print { .student-card { box-shadow: none; } body { margin: 5mm; } }`
  - `.card-header { background: linear-gradient(...); color: white; padding: 4mm; }`
  - `.avatar-circle { width: 50px; height: 50px; border-radius: 50%; border: 2px solid white; }`
  - `.fallback-avatar { background: linear-gradient(135deg, #61BAE2, #6455F0); display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; font-weight: bold; }`

### 2. `src/components/CredentialsDialog.tsx`

- اضافة import: `CreditCard` من lucide + `generateStudentCard` من `@/lib/pdfReports`
- في الفوتر (سطر 106)، قبل زرار "نسخ الكل":
  - زرار `Button variant="outline"` بايقونة `CreditCard`
  - نص: "طباعة البطاقة" / "Print Card"
  - يظهر فقط لو `password` موجود وغير فارغ: `{password && ( ... )}`
  - `onClick`: يتحقق ان `password` مش فاضي قبل التنفيذ (double guard)
  - يستدعي: `generateStudentCard({ name: userName, email }, { password, isRTL })`
  - الكارد هنا مختصر (اسم + ايميل + باسورد فقط) لان باقي البيانات مش متاحة في الـ dialog

### 3. `src/pages/Students.tsx`

- اضافة `CreditCard` في import lucide (سطر 3)
- اضافة import: `generateStudentCard` من `@/lib/pdfReports`
- **Mobile dropdown** (سطر 1111، بعد Edit وقبل Delete):
  ```text
  <DropdownMenuItem onClick={(e) => {
    e.stopPropagation();
    if (role !== 'admin' && role !== 'reception') return;
    generateStudentCard({
      name: student.full_name,
      nameAr: student.full_name_ar || undefined,
      email: student.email,
      phone: student.phone || undefined,
      avatarUrl: student.avatar_url || undefined,
      ageGroup: getAgeGroupName(student.age_group_id),
      level: getLevelName(student.level_id),
      subscriptionType: getSubscriptionTypeName(student.subscription_type),
      attendanceMode: getAttendanceModeName(student.attendance_mode),
    }, { isRTL });
  }}>
    <CreditCard className="h-4 w-4 mr-2" />
    {isRTL ? 'بطاقة الطالب' : 'Student Card'}
  </DropdownMenuItem>
  ```
  - ملاحظة: `getAgeGroupName` وغيرها ترجع `-` لو القيمة null، فالدالة `generateStudentCard` هتتعامل مع `-` كقيمة فارغة وما تعرضهاش
- **Desktop dropdown** (سطر 1243، بعد Edit وقبل Delete): نفس الكود بدون `e.stopPropagation()`
- الزرار يظهر فقط لو `role === 'admin' || role === 'reception'` (شرط عرض + شرط onClick)

### 4. `src/pages/StudentProfile.tsx`

- اضافة `CreditCard` في import lucide (سطر 5)
- اضافة import: `generateStudentCard` من `@/lib/pdfReports`
- اضافة import: `getSubscriptionTypeLabel, getAttendanceModeLabel` من `@/lib/constants`
- زرار جديد (سطر 294، قبل زرار PDF Report):
  - يظهر لـ `role === 'admin' || role === 'reception'` فقط
  - `onClick` يتحقق من الصلاحية قبل التنفيذ
  - يمرر كل البيانات المتاحة من `data.profile`, `data.group`, `data.subscription`:
    ```text
    generateStudentCard({
      name: data.profile.full_name,
      nameAr: data.profile.full_name_ar || undefined,
      email: data.profile.email,
      phone: data.profile.phone || undefined,
      avatarUrl: data.profile.avatar_url || undefined,
      ageGroup: data.profile.age_groups ? (isRTL ? data.profile.age_groups.name_ar : data.profile.age_groups.name) : undefined,
      level: data.profile.levels ? (isRTL ? data.profile.levels.name_ar : data.profile.levels.name) : undefined,
      subscriptionType: data.subscription?.subscription_type ? getSubscriptionTypeLabel(data.subscription.subscription_type, isRTL) : undefined,
      attendanceMode: data.subscription?.attendance_mode ? getAttendanceModeLabel(data.subscription.attendance_mode, isRTL) : undefined,
      group: data.group ? (isRTL ? data.group.name_ar : data.group.name) : undefined,
    }, { isRTL });
    ```
  - بدون باسورد

---

## معايير القبول

- كارد branded بمقاس 86mm x 54mm مع gradient header و padding 2mm
- نسختين في صفحة الطباعة (طالب + ارشيف) مع label فوق كل نسخة
- صورة دائرية مع fallback (حرف اول) يشتغل حتى لو CORS منع الصورة
- كل حقل فاضي او يساوي "-" ما يظهرش على الكارد
- الباسورد يظهر فقط من CredentialsDialog ولو password فعلا موجود
- onClick محمي بشرط role حتى لو الزرار ظهر بالغلط
- الازرار مخفية عن غير admin و reception
- shadow على الشاشة فقط ويتشال في print
- هوامش الطباعة صغيرة (5mm)
- line-height 1.6 للعربي
- RTL/LTR كامل في كل الحقول والاتجاهات
- `openPrintWindow` الحالي مستخدم بدون تكرار كود
