

# نظام المحفظة المالية (Salary Wallet) - خطة التنفيذ الكاملة

## ملخص المشروع

تحويل نظام الرواتب الحالي من نظام "payment-based" (كل بونص/خصم = سجل دفع منفصل) الى نظام "event-driven ledger" (محفظة مالية لحظية لكل موظف).

---

## الوضع الحالي

- البونص والخصومات بتتسجل في `salary_payments` بـ `base_amount = 0` وبتظهر كأنها "مدفوعة"
- مفيش تتبع لحظي للرصيد
- سلمى عندها بونص 200 ج.م مسجل كـ payment مدفوع بالفعل
- بسمة عندها راتب ثابت 4000 ج.م
- قواعد خصم موجودة (non_compliance x2 = 200 ج.م) بس مبتتطبقش تلقائي

---

## Sprint 1: قاعدة البيانات + Triggers

### 1.1 جدول `salary_events` (دفتر القيود - Immutable)

```text
salary_events
--------------
id               UUID PK DEFAULT gen_random_uuid()
employee_id      UUID NOT NULL
month            DATE NOT NULL (اول يوم في الشهر)
event_type       TEXT NOT NULL
                 ('base_salary' | 'hourly_earning' | 'bonus' | 'deduction' | 'warning_deduction')
amount           NUMERIC NOT NULL (موجب دائما)
description      TEXT
description_ar   TEXT
source           TEXT NOT NULL ('system' | 'manual' | 'warning_rule' | 'session')
reference_id     UUID (nullable)
is_reversal      BOOLEAN DEFAULT false
reversed_event_id UUID (nullable)
metadata         JSONB DEFAULT '{}'
created_by       UUID
created_at       TIMESTAMPTZ DEFAULT now()
```

- **قيود مهمة**: لا UPDATE ولا DELETE على هذا الجدول (enforced بـ trigger)
- **Indexes**: (employee_id, month), (created_at), partial index على الشهور المفتوحة
- **RLS**: Admin full access, Employee SELECT own records

### 1.2 جدول `salary_month_snapshots` (كاش)

```text
salary_month_snapshots
-----------------------
id               UUID PK DEFAULT gen_random_uuid()
employee_id      UUID NOT NULL
month            DATE NOT NULL
base_amount      NUMERIC DEFAULT 0
total_earnings   NUMERIC DEFAULT 0
total_bonuses    NUMERIC DEFAULT 0
total_deductions NUMERIC DEFAULT 0
net_amount       NUMERIC DEFAULT 0
status           TEXT DEFAULT 'open' CHECK (status IN ('open', 'locked', 'paid'))
finalized_at     TIMESTAMPTZ
finalized_by     UUID
updated_at       TIMESTAMPTZ DEFAULT now()
UNIQUE(employee_id, month)
```

- **RLS**: Admin full access, Employee SELECT own records

### 1.3 Database Triggers

**Trigger 1: `prevent_salary_events_mutation`** (BEFORE UPDATE/DELETE on salary_events)
- يرفض اي UPDATE او DELETE - الجدول append-only فقط

**Trigger 2: `enforce_month_lock`** (BEFORE INSERT on salary_events)
- لو snapshot.status = 'paid': يرفض العملية تماما
- لو snapshot.status = 'locked': يسمح فقط بـ reversal events
- يستخدم `SELECT ... FOR UPDATE` على snapshot row لمنع race conditions

**Trigger 3: `recalculate_salary_snapshot`** (AFTER INSERT on salary_events)
- يعيد حساب snapshot من كل events الشهر (مش incremental - اعاده حساب كامل)
- يضم الراتب الاساسي من `employee_salaries`
- Upsert في `salary_month_snapshots`

**Trigger 4: `auto_warning_deduction`** (AFTER INSERT on instructor_warnings)
- يحسب عدد الانذارات النشطة من نفس النوع للموظف
- يشيك على `warning_deduction_rules`
- لو وصل للعدد المطلوب ومفيش event خصم مكرر: يضيف `warning_deduction` event
- يبعت notification بالرصيد الجديد

**Function: `rebuild_salary_snapshot(p_employee_id UUID, p_month DATE)`**
- تعيد حساب snapshot من الصفر من events
- تستخدم للـ debugging و data repair و audits

### 1.4 ترحيل البيانات

- سجل بونص سلمى الحالي (200 ج.م في salary_payments) يترحل كـ salary_event من نوع `bonus`
- الـ salary_payments record القديم يفضل مكانه كـ archive

---

## Sprint 2: واجهة الادمن (SalariesTab.tsx) - اعادة بناء كاملة

### التغييرات الرئيسية

**تاب الموظفين:**
- عمود "الرصيد الحالي" يقرأ من `salary_month_snapshots` (سريع)
- عمود "الحالة" يعرض: open / locked / paid
- ازرار "بونص" و "خصم" تضيف event في `salary_events` (بدل salary_payments)
- زر "قفل الشهر" (Lock): يغير status الى locked
- زر "صرف" (Pay): بعد القفل، يحول snapshot لـ salary_payments record نهائي ويغير status الى paid

**تاب سجل الحركات (جديد):**
- كل salary_events مفلترة بالشهر
- امكانية عكس حركة (reversal event)
- Running balance يتحسب بـ window function مش stored

**تاب سجل الصرف:**
- يعرض salary_payments النهائية فقط (اللي base_amount > 0)

### الحذف
- حذف منطق الـ adjustment الحالي اللي بيسجل في salary_payments بـ base_amount = 0

---

## Sprint 3: واجهة الموظف (Profile.tsx) - شكل بنكي

### التصميم الجديد لقسم المالية

**بطاقة الرصيد الكبيرة:**
```text
+------------------------------------------+
|       راتبك الحالي - فبراير 2026          |
|            3,800 ج.م                      |
|       الراتب الاساسي: 4,000 ج.م           |
|        الحالة: مفتوح                      |
+------------------------------------------+
```

**Timeline الحركات:**
- كل event يعرض بشكل زمني مع الوصف والمبلغ
- Running balance بعد كل حركة (يتحسب بـ SQL window function، مش stored)
- الوان مختلفة: اخضر للزيادات، احمر للخصومات

**سجل المدفوعات السابقة:**
- الشهور المصروفة فقط من salary_payments

---

## Sprint 4: الربط التلقائي + الاشعارات

### ربط الانذارات بالخصومات (IssueEmployeeWarningDialog.tsx)

بعد اصدار انذار:
1. الـ DB trigger `auto_warning_deduction` يشيك على القواعد تلقائيا
2. لو وصل للعدد المطلوب: يضيف warning_deduction event
3. يبعت notification: "خصم انذار 200 ج.م - رصيدك الحالي: X ج.م"

### اشعارات فورية

كل event مالي يبعت notification:
- بونص: "تم اضافة بونص 200 ج.م - رصيدك: 4,200 ج.م"
- خصم: "خصم 150 ج.م بسبب... - رصيدك: 3,850 ج.م"

---

## الملفات المتأثرة

| الملف | التغيير |
|-------|---------|
| Migration جديد | جداول salary_events + salary_month_snapshots + 4 triggers + rebuild function + indexes + RLS + ترحيل بيانات |
| `src/components/finance/SalariesTab.tsx` | اعادة بناء كاملة: قراءة من salary_events/snapshots، ازرار تضيف events، نظام lock/pay، تاب حركات جديد |
| `src/pages/Profile.tsx` | قسم المالية: بطاقة رصيد بنكية + timeline حركات + سجل مدفوعات |
| `src/components/instructor/IssueEmployeeWarningDialog.tsx` | الـ trigger في DB هيتكفل بالخصم التلقائي - مش محتاج تعديل في الكود لأن المنطق كله في الـ trigger |

---

## التفاصيل التقنية للأمان

### Atomicity (منع race conditions)
- كل INSERT في salary_events يعمل `SELECT ... FOR UPDATE` على snapshot row الاول
- ده يضمن ان كل حساب يتم بشكل متسلسل لنفس الموظف/الشهر

### Immutable Ledger
- trigger يمنع UPDATE/DELETE على salary_events تماما
- التصحيح يتم بـ reversal event فقط (is_reversal = true)

### Month Locking
- `open`: يستقبل اي events
- `locked`: reversal events فقط
- `paid`: ممنوع اي event (enforced في DB trigger)

### Performance
- Indexes على (employee_id, month) و (created_at)
- snapshot كـ cache يمنع اعادة الحساب من الصفر كل مرة
- rebuild function متاحة للصيانة

### تدفق النظام

```text
حدث (انذار/بونص/خصم يدوي)
        |
        v
  enforce_month_lock (BEFORE INSERT)
        |-- لو paid: رفض
        |-- لو locked: reversal فقط
        |
        v
  salary_events (INSERT - append only)
        |
        v
  recalculate_salary_snapshot (AFTER INSERT)
        |-- SELECT FOR UPDATE على snapshot
        |-- اعادة حساب كامل من events
        |-- UPSERT في snapshots
        |
        v
  UI يعرض الرصيد لحظيا
        |
        v
  نهاية الشهر: Lock --> Review --> Pay
        |
        v
  salary_payments (سجل نهائي)
  snapshot.status = 'paid'
```

