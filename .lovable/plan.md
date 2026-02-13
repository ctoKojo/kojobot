

# النظام المالي - النسخة العملية المبسطة

## الفلسفة

نبني اللي محتاجينه فعلا دلوقتي، مش اللي ممكن نحتاجه بعد سنتين. جدول حضور + حساب ساعات + صرف رواتب. خلاص.

---

## المرحلة 1: حضور الموظفين وحساب الراتب بالساعة

### 1.1 جدول جديد: `session_staff_attendance`

| العمود | النوع | ملاحظات |
|--------|-------|---------|
| id | uuid PK | |
| session_id | uuid NOT NULL | FK -> sessions |
| staff_id | uuid NOT NULL | |
| status | text NOT NULL DEFAULT 'confirmed' | confirmed / absent / inferred |
| actual_hours | numeric NOT NULL | |
| created_at | timestamptz DEFAULT now() | |

- UNIQUE على (session_id, staff_id)
- RLS: الادمن ALL، المدرب SELECT+UPDATE على سيشناته، الريسيبشن SELECT+INSERT+UPDATE
- Migration script يعلم السيشنات القديمة المكتملة بـ `inferred` مع `actual_hours = duration_minutes / 60.0`

### 1.2 تعديل `SessionDetails.tsx`

- قسم "حضور المدرب" للسيشنات المكتملة
- زر تاكيد حضور / غياب
- حقل ساعات فعلية (افتراضي = مدة السيشن)
- Badge ملونة (اخضر=مؤكد، احمر=غائب، رمادي=تقديري)

### 1.3 تعديل `SalariesTab.tsx`

- المتدرب بالساعة يعرض: "X ساعة = Y ج.م" بدل "غير محدد"
- الحساب: جلب attendance حيث status IN (confirmed, inferred) للشهر، جمع actual_hours، تقريب لاقرب ربع ساعة، ضرب في hourly_rate
- ايقونة تحذير بجانب بيانات inferred
- دايلوج الصرف يعرض تفصيل السيشنات + pipeline بسيط (اساسي - خصومات + بونص = صافي)

---

## المرحلة 2 (لاحقا بعد الاستقرار): snapshots وقفل الشهر

### 2.1 جدول `payroll_periods`

| العمود | النوع |
|--------|-------|
| id | uuid PK |
| start_date | date |
| end_date | date |
| status | text | open / locked |
| locked_at | timestamptz |
| locked_by | uuid |

### 2.2 جدول `payroll_items`

- يخزن snapshot لبنود الراتب وقت الصرف
- يربط بـ salary_payment_id
- بعد القفل = read only (trigger بسيط)

### 2.3 ربط period_id بـ salary_payments

- الشهر المقفول لا يتأثر بتعديلات لاحقة

---

## ملخص الملفات - المرحلة 1 فقط

### Database
1. جدول `session_staff_attendance` + RLS + UNIQUE constraint
2. Migration script للسيشنات القديمة

### تعديل
1. `src/pages/SessionDetails.tsx` - قسم حضور المدرب
2. `src/components/finance/SalariesTab.tsx` - حساب ساعات + عرض محسن + تفصيل في دايلوج الصرف

### ملف جديد محتمل
1. `src/components/finance/PayrollDialog.tsx` - دايلوج صرف محسن (ملخص + تفصيل سيشنات + pipeline)

---

## القواعد

| القاعدة | التفاصيل |
|---------|----------|
| التقريب | اقرب ربع ساعة |
| السيشنات القديمة | inferred مع تحذير |
| Pipeline | اساسي - خصومات + بونص = صافي |
| الصلاحيات | الادمن فقط يصرف |

