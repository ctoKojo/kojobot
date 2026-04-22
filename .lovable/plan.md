

## تطبيق RTL شامل على الجداول والتابات في الموقع كله

المشكلة: الجداول (`Table`) والتابات (`Tabs`) مش بتطبق اتجاه RTL بشكل صحيح لما اللغة عربي، رغم إن `document.documentElement.dir` بيتظبط على `rtl` في `LanguageContext`.

### السبب الجذري

1. **`src/components/ui/table.tsx`**: مفيش أي معالجة لـ RTL. الأعمدة بتفضل LTR حتى لو الصفحة `dir="rtl"`، لأن Tailwind classes زي `pr-0` و `pl-2.5` ثابتة ومش logical (مش `pe/ps`).
2. **`src/components/ui/tabs.tsx`**: نفس المشكلة - `TabsList` مبني على flex بدون اعتبار للاتجاه، والأيقونات في `TabsTrigger` بتظهر في الترتيب الغلط.
3. **`src/components/ui/data-table-pagination.tsx`**: بيستخدم `isRTL` لتبديل أيقونات الـ chevron يدوياً، لكن الـ `flex` direction مش متظبط.
4. **استخدامات متفرقة**: ملفات كتير بتستخدم `text-left`, `ml-`, `mr-`, `pl-`, `pr-`, `space-x-` بدل البدائل الـ logical (`text-start`, `ms-`, `me-`, `ps-`, `pe-`, `gap-`).

### خطة التنفيذ

**1. إصلاح `src/components/ui/table.tsx` (جذر المشكلة)**
- إضافة `dir` attribute تلقائي على `<table>` من `useLanguage()` أو الاعتماد على CSS inheritance من `<html dir>`.
- تغيير `TableHead`: `text-left` → `text-start`، و `pr-0` → `pe-0` للـ checkbox.
- تغيير `TableCell`: `pr-0` → `pe-0`.
- إضافة `[dir="rtl"]` selectors للـ wrapper عشان `overflow-auto` يشتغل صح مع scroll RTL.

**2. إصلاح `src/components/ui/tabs.tsx`**
- `TabsList`: استخدام `gap-` بدل `space-x-` لضمان السلوك في RTL.
- `TabsTrigger`: استبدال `ml-/mr-` بـ `ms-/me-`.
- إضافة `dir="rtl"` على `TabsList` لما اللغة عربي عشان `data-state` indicator يتحرك صح.

**3. تحسين `src/components/ui/data-table-pagination.tsx`**
- استبدال أيقونات `ChevronLeft/Right` بمنطق logical موحد بدل التبديل اليدوي.
- استخدام `flex-row-reverse` تلقائياً في RTL لو محتاج.

**4. مراجعة الاستخدامات في كل الموقع**
- بحث شامل عن `text-left`, `text-right`, `pl-`, `pr-`, `ml-`, `mr-`, `space-x-` في كل ملفات `src/`.
- استبدال بالبدائل الـ logical (`text-start/end`, `ps-/pe-`, `ms-/me-`, `gap-`).
- التركيز على الصفحات المتأثرة: `Finance.tsx`, `Students.tsx`, `Sessions.tsx`, `Groups.tsx`, `ActivityLog.tsx`, `SubscriptionRequests.tsx`, وكل ملفات `src/components/finance/*`, `src/components/student/*`, `src/components/curriculum/*`.

**5. إصلاح Tabs محددة في صفحات معروفة**
- `Finance.tsx`: التأكد إن `TabsList` بتعرض التابات بترتيب صحيح في RTL.
- `StudentProfile.tsx`: التابات الأفقية القابلة للتمرير لازم تبدأ من اليمين في RTL.
- `Settings.tsx`, `GroupDetails.tsx`: نفس المعالجة.

**6. اختبار وتحقق**
- استخدام Browser tools للتنقل بين `/finance`, `/students`, `/groups`, `/curriculum` مع اللغة العربية والتأكد من:
  - الجداول: العناوين على اليمين، أعمدة الإجراءات على الشمال.
  - التابات: أول تاب على اليمين، الـ active indicator بيتحرك صح.
  - الـ Pagination: أيقونات السهم في اتجاه صحيح.
  - الأيقونات داخل الأزرار والبادجات: المسافات صحيحة.

### الملفات المتوقع تعديلها

**أساسية (UI primitives)**:
- `src/components/ui/table.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/data-table-pagination.tsx`

**صفحات وكومبوننتس**:
- `src/pages/Finance.tsx`, `Students.tsx`, `Sessions.tsx`, `Groups.tsx`, `GroupDetails.tsx`, `StudentProfile.tsx`, `ActivityLog.tsx`, `SubscriptionRequests.tsx`, `CertificatesQueue.tsx`, `Settings.tsx`, وغيرها حسب نتيجة البحث.
- `src/components/finance/*` (كل التابات والجداول).
- `src/components/shared/SortableTableHead.tsx`, `TableToolbar.tsx`, `StatsGrid.tsx`.
- `src/features/students/components/StudentsTable.tsx`.

### ملاحظات تقنية

- مش هنغير `LanguageContext` لأنه بالفعل بيظبط `dir="rtl"` على الـ `<html>`.
- الاعتماد على Tailwind logical properties (`ms-`, `me-`, `ps-`, `pe-`, `text-start`, `text-end`) اللي بتستجيب تلقائياً لـ `dir`.
- لو فيه أماكن محتاجة direction explicit (زي CodeBlocks)، هنحافظ على `dir="ltr"` المحدد فيها (طبقاً لـ Mixed Language Rendering rule).
- مفيش تغييرات على قاعدة البيانات أو الـ backend.

