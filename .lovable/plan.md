

# تتبع الاقساط والتدفق النقدي + اصلاح تاريخ الدفع

## 5 ملفات (2 جديدة + 3 تعديل)

---

### 1. اصلاح تاريخ الدفع الفعلي

#### `src/components/student/CreateSubscriptionDialog.tsx`
- اضافة state: `paymentDate` (default = `new Date().toISOString().split('T')[0]`)
- اضافة حقل date input بعنوان "تاريخ الدفع الفعلي" / "Actual Payment Date" بعد حقل "المبلغ المدفوع" مباشرة (يظهر فقط لو `paidAmount > 0`)
- سطر 114: استبدال `new Date().toISOString().split('T')[0]` بـ `paymentDate` في insert payment

#### `src/pages/Students.tsx`
- اضافة `payment_date` في formData state (default = اليوم)
- اضافة حقل "تاريخ الدفع الفعلي" في قسم الاشتراك (يظهر لو `sub_paid_amount > 0`)
- سطر 403: استبدال `new Date().toISOString().split('T')[0]` بـ `formData.payment_date` في insert payment

---

### 2. `src/components/finance/PaymentTrackerTab.tsx` (ملف جديد)

تاب "متابعة الاقساط" متاح للادمن والريسيبشن.

**البيانات:** يجلب subscriptions النشطة (payment_type = 'installment' او remaining > 0) مع profiles و pricing_plans. يجلب payments لتحديد حالة السداد.

**4 بطاقات ملخص:**
- مستحق هذا الشهر: `next_payment_date` بين اول واخر الشهر الحالي (عدد + اجمالي installment_amount)
- مستحق الشهر القادم: نفس المنطق للشهر القادم
- اشتراكات تنتهي خلال 15 يوم: `end_date` بين اليوم و +15 يوم
- موقوفين: `is_suspended = true`

**3 جداول:**

1. **مستحق هذا الشهر:**
   - اعمده: اسم الطالب، الباقة، نوع الدفع، القسط (`installment_amount`)، تاريخ الاستحقاق، اخر payment_date، حالة السداد، زر دفعة
   - حالة السداد (مربوطة بدورة الاستحقاق مش بشهر الكالندر):
     - **مدفوع**: يوجد payment مرتبط بنفس `subscription_id` وتاريخه (`payment_date`) بين `next_payment_date - 30 يوم` و `next_payment_date` (نافذة دورة الاستحقاق)
     - **متاخر**: `next_payment_date` < اليوم ولا يوجد payment في نافذة الدورة
     - **قادم**: `next_payment_date` >= اليوم ولا يوجد payment في نافذة الدورة
   - تلوين: اخضر/احمر/اصفر
   - ترتيب: الاقرب تاريخا اولا

2. **مستحق الشهر القادم:** نفس الشكل

3. **اشتراكات تنتهي قريبا:**
   - اعمده: اسم الطالب، الباقة، نوع الدفع، تاريخ الانتهاء، المتبقي ماليا، ايام متبقية، زر للانتقال لبروفايل الطالب

**زر "دفعة":**
- يفتح dialog تسجيل payment (نفس UI الموجود في Finance.tsx: اسم الطالب، المتبقي، حقل المبلغ default = installment_amount، طريقة الدفع، ملاحظات)
- بعد الحفظ: يحدث `next_payment_date` بمنطق advance:
  - عدد الاقساط المغطاة = `Math.floor(amount / installment_amount)`
  - لو عدد الاقساط >= 1: يحرك `next_payment_date` بمقدار `عدد الاقساط * 30 يوم` للامام من `next_payment_date` الحالي
  - لو الدفعه جزئيه (اقل من قسط واحد): يحدث `paid_amount` فقط ولا يحرك `next_payment_date`
  - لو `remaining_amount` بعد الدفع <= 0: يخلي `next_payment_date = null`
- يعمل refetch بعد التسجيل

**ملاحظة مهمة:** نفس منطق advance لـ `next_payment_date` يتطبق ايضا على `handleRecordPayment` في Finance.tsx (تعديل السطر 173-178 ليستخدم advance من next_payment_date الحالي بدل حساب من start_date)

---

### 3. `src/components/finance/CashFlowTab.tsx` (ملف جديد، Admin فقط)

**3 بطاقات الشهر الحالي:**
- Cash In الفعلي: اجمالي `payments` هذا الشهر حسب `payment_date`
- المصروفات: اجمالي `expenses` هذا الشهر حسب `expense_date`
- صافي التدفق الفعلي: Cash In - المصروفات

**قسم المتوقع (منفصل تماما عن الصافي):**
- اقساط مستحقة هذا الشهر لم تدفع بعد (subscriptions نشطة، next_payment_date في الشهر الحالي، مفيش payment في نافذة الدورة)
- اقساط الشهر القادم (كل subscriptions نشطة بـ next_payment_date في الشهر القادم)

**شارت بار اخر 6 شهور (Recharts):**
- بار اخضر: الوارد (payments الفعلية حسب payment_date)
- بار احمر: المصروفات (expenses حسب expense_date)
- خط: صافي التدفق الشهري (الوارد - المصروفات)
- يجلب فقط payments و expenses اخر 6 شهور

---

### 4. تعديل `src/pages/Finance.tsx`

- import PaymentTrackerTab و CashFlowTab
- اضافة تابين في TabsList بعد "Reports":
  - "متابعة الاقساط" / "Payment Tracker" (يظهر دائما -- admin + reception)
  - "التدفق النقدي" / "Cash Flow" (يظهر فقط لو `role === 'admin'`)
- اضافة TabsContent لكل تاب
- تعديل منطق `handleRecordPayment` (سطر 173-178): بدل حساب next_payment_date من start_date، يستخدم advance من next_payment_date الحالي:
  ```
  const installmentsCovered = Math.floor(paymentAmount / selectedSub.installment_amount);
  if (installmentsCovered >= 1 && selectedSub.next_payment_date) {
    const currentNPD = new Date(selectedSub.next_payment_date);
    nextPaymentDate = new Date(currentNPD.getTime() + installmentsCovered * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  }
  // لو دفعه جزئيه: لا يتحرك next_payment_date
  ```

---

## ملخص الملفات

| الملف | نوع التعديل |
|-------|-------------|
| `src/components/student/CreateSubscriptionDialog.tsx` | تعديل - حقل تاريخ الدفع الفعلي |
| `src/pages/Students.tsx` | تعديل - حقل تاريخ الدفع الفعلي |
| `src/components/finance/PaymentTrackerTab.tsx` | جديد - تاب متابعة الاقساط |
| `src/components/finance/CashFlowTab.tsx` | جديد - تاب التدفق النقدي |
| `src/pages/Finance.tsx` | تعديل - اضافة التابين + تعديل منطق advance next_payment_date |

## ملاحظات
- لا تغييرات داتا بيز مطلوبة
- معيار "مدفوع" مبني على نافذة دورة الاستحقاق (next_payment_date - 30 يوم الى next_payment_date) مش شهر الكالندر
- تحريك next_payment_date يدعم الدفع الجزئي (لا يتحرك) والدفع لاكتر من قسط (يتحرك بعدد الاقساط المغطاة)
- installment_amount من subscriptions كمصدر وحيد لقيمة القسط
- كل الاستعلامات مفلترة بالنطاق الزمني المطلوب فقط
- RTL/LTR كامل
