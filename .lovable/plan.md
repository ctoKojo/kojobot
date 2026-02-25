

# تعديل منطق الاقساط والصلاحيات المالية

## المشاكل الحالية

1. **التقسيط لا يغير الاجمالي**: `totalAmount` دايما = `price_3_months` سواء دفع كامل او تقسيط
2. **reception يقدر يعدل كل الحقول المالية** بدون قيود
3. **الاجمالي والمدفوع قابلين للتعديل اليدوي** في EditSubscriptionDialog

## التعديلات

### 1. `CreateSubscriptionDialog.tsx`

**تعديل حساب الاجمالي (سطر 74-78):**
- حاليا: `totalAmount = price_3_months - discountAmount` دايما
- الجديد:
  - `full`: `totalAmount = price_3_months * (1 - discount/100)`
  - `installment`: `totalAmount = (price_1_month * 3) * (1 - discount/100)`
  - `installmentAmount = price_1_month * (1 - discount/100)`

**تعديل الملخص (Summary Card):**
- عرض السعر الاصلي حسب نوع الدفع (3 شهور للكامل، شهر × 3 للتقسيط)
- توضيح الفرق بين سعر الدفع الكامل وسعر التقسيط

### 2. `EditSubscriptionDialog.tsx`

**اضافة صلاحيات الدور:**
- `import { useAuth }` واستخدام `role`
- `isAdmin = role === 'admin'`
- الحقول المالية (`الباقة`، `نوع الدفع`، `الخصم`، `الحالة`، `ايقاف الحساب`) تكون `disabled` لغير الادمن
- بانر تحذيري للـ reception: "التعديلات المالية تحتاج موافقة الادمن"

**اضافة `handlePaymentTypeChange`:**
- لما يتغير نوع الدفع يعيد حساب الاجمالي والقسط الشهري بنفس المنطق الجديد

**تعديل `handlePlanChange` و `handleDiscountChange`:**
- يحسبوا الاجمالي حسب `paymentType` الحالي (مش دايما `price_3_months`)

**جعل الاجمالي والمدفوع read-only:**
- ازالة حقول التعديل اليدوي للـ `totalAmount` و `paidAmount`
- عرضهم كقيم محسوبة في الملخص فقط
- `paidAmount` يتحمل من الاشتراك الموجود (مصدره `payments` عبر الـ computed column)

**تعديل `handleSave`:**
- ازالة `paid_amount` من `updateData` (مصدره `payments` فقط)
- ابقاء `total_amount` في `updateData` لانه محسوب من الباقة + الخصم + نوع الدفع (الادمن فقط يقدر يغيره عبر تغيير الباقة/الخصم/نوع الدفع)

### ملاحظة امنية

`remaining_amount` عمود محسوب بالفعل في قاعدة البيانات (`total_amount - paid_amount`) -- لا يحتاج تعديل.
الحماية الاضافية على مستوى الباك اند (RLS/triggers) غير مطلوبة حاليا لان:
- `paid_amount` يتحدث فقط عبر `payments` في صفحة Finance (اللي عندها RLS صحيح)
- reception مش هيقدر يبعث update للحقول المالية لان الفرونت هيمنعه، وRLS على `subscriptions` بالفعل يسمح لـ admin فقط بالـ update

## الملفات المتأثرة

| الملف | التعديل |
|-------|---------|
| `src/components/student/CreateSubscriptionDialog.tsx` | حساب `totalAmount` حسب `paymentType` + تحديث الملخص |
| `src/components/student/EditSubscriptionDialog.tsx` | صلاحيات حسب الدور + حساب ديناميكي + حقول read-only |
