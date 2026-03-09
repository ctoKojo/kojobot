

## ملخص المشكلة

الموعد المحدد للامتحان انتهى بالفعل. المشكلة ليست في الكود بل في البيانات — لكن هناك تحسينات مهمة مطلوبة لمنع تكرار هذه المشكلة.

---

## الخطة

### 1. منع جدولة مواعيد في الماضي (SchedulePlacementDialog)
- إضافة validation يمنع حفظ موعد إذا كان `opensAt` قبل الوقت الحالي
- إظهار toast خطأ واضح للمجدول

### 2. إضافة حالة "Expired" في PlacementGate
- حالة جديدة `expired` بدلاً من إظهار "لم يتم تحديد موعد"
- عرض تفاصيل الموعد المنتهي (التاريخ والوقت)
- رسالة واضحة للطالب للتواصل مع الإدارة لإعادة الجدولة

### 3. إصلاح حساب وقت Cairo في SchedulePlacementDialog
- إضافة دالة `getCairoCurrent()` للحصول على الوقت الحالي بتوقيت Cairo
- المقارنة تتم بتوقيت Cairo وليس توقيت المتصفح

---

## التفاصيل التقنية

### SchedulePlacementDialog - منع الجدولة في الماضي:
```typescript
// Get Cairo "now" for comparison
const cairoNow = new Date().toLocaleString('en-US', { timeZone: APP_TIMEZONE });
const nowUtc = fromZonedTime(new Date(cairoNow), APP_TIMEZONE);

if (opensAt <= nowUtc) {
  toast({
    title: 'وقت البداية في الماضي',
    description: 'لا يمكن جدولة امتحان يبدأ قبل الوقت الحالي',
    variant: 'destructive',
  });
  return;
}
```

### PlacementGate - حالة Expired:
```typescript
type PlacementStatus = '...' | 'expired';

// في fetchSchedule:
if (now > closesAt) {
  setStatus('expired');  // بدلاً من 'not_scheduled'
  setSchedule(scheduleData);
}
```

```tsx
{/* Expired State */}
{status === 'expired' && schedule && (
  <>
    <ShieldAlert className="text-orange-500" />
    <h2>انتهى موعد الامتحان</h2>
    <p>الموعد السابق: {formatDateTime(schedule.opens_at)} - {formatDateTime(schedule.closes_at)}</p>
    <p>يرجى التواصل مع الإدارة لتحديد موعد جديد</p>
  </>
)}
```

---

## الملفات المتأثرة

| الملف | التغيير |
|-------|---------|
| `src/components/student/SchedulePlacementDialog.tsx` | منع الجدولة في الماضي |
| `src/pages/PlacementGate.tsx` | إضافة حالة `expired` مع UI مميز |

