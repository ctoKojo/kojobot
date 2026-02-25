

# اصلاح حساب التقسيط في صفحة إضافة الطالب (`Students.tsx`)

## المشكلة

الباج موجود في `src/pages/Students.tsx` مش في `CreateSubscriptionDialog.tsx` (اللي اتصلح قبل كده). صفحة "إضافة طالب" فيها نسخة منفصلة من حساب الاشتراك وهي اللي لسه بتستخدم `price_3_months` دايما بغض النظر عن نوع الدفع.

## المطلوب

تعديل مكانين في `src/pages/Students.tsx`:

### 1. منطق الحفظ (سطر 374)

**الحالي:**
```
const baseTotal = selectedPlan.price_3_months;
```

**الجديد:**
```
const baseTotal = formData.payment_type === 'installment' 
  ? selectedPlan.price_1_month * 3 
  : selectedPlan.price_3_months;
```

### 2. الملخص في الواجهة (سطر 1012)

**الحالي:**
```
const originalTotal = plan.price_3_months;
```

**الجديد:**
```
const originalTotal = formData.payment_type === 'installment' 
  ? plan.price_1_month * 3 
  : plan.price_3_months;
```

نفس المنطق اللي موجود بالفعل في `CreateSubscriptionDialog.tsx` سطر 76.

## الملفات المتأثرة

| الملف | التعديل |
|-------|---------|
| `src/pages/Students.tsx` | سطر 374 + سطر 1012: ربط `baseTotal`/`originalTotal` بنوع الدفع |

