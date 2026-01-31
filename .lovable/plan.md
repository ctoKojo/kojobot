
# خطة إصلاح صلاحيات الإنستراكتور

## المشاكل المكتشفة

### 1. في صفحة GroupDetails.tsx
- **زر إعادة جدولة السيشنات (RescheduleDialog)**: متاح للجميع بدون تحقق من الصلاحيات
- **زر تعديل السيشن (EditSessionDialog)**: يظهر لكل من يفتح الصفحة ويسمح بتغيير التاريخ والوقت
- يجب أن يكون تعديل مواعيد المجموعة للأدمن فقط

### 2. في صفحة Sessions.tsx
- الإنستراكتور لديه صلاحية حذف السيشن (`handleDelete`)
- الإنستراكتور لديه صلاحية تعديل تفاصيل السيشن (الموضوع والحالة والملاحظات)
- **المشكلة**: `canManage = role === 'admin' || role === 'instructor'` مما يعطي الإنستراكتور صلاحيات واسعة جداً

---

## التعديلات المطلوبة

### 1. GroupDetails.tsx

**أ) إخفاء RescheduleDialog من الإنستراكتور:**
```tsx
// قبل
<RescheduleDialog ... />

// بعد - إضافة شرط الأدمن
{role === 'admin' && (
  <RescheduleDialog ... />
)}
```

**ب) تقييد EditSessionDialog للأدمن فقط:**
```tsx
// قبل
{session.status === 'scheduled' && (
  <EditSessionDialog ... />
)}

// بعد
{role === 'admin' && session.status === 'scheduled' && (
  <EditSessionDialog ... />
)}
```

**ج) إضافة استيراد useAuth وتعريف role:**
```tsx
import { useAuth } from '@/contexts/AuthContext';

// داخل الكومبوننت
const { role } = useAuth();
```

---

### 2. Sessions.tsx

**أ) تعديل صلاحيات الإجراءات:**
```tsx
// الحالي
const canManage = role === 'admin' || role === 'instructor';

// الإنستراكتور يستطيع:
// ✅ تسجيل الحضور
// ✅ تغيير الحالة (Mark Complete)
// ✅ تعديل الموضوع والملاحظات
// ❌ حذف السيشن
// ❌ تغيير التاريخ أو الوقت
```

**ب) إخفاء زر الحذف من الإنستراكتور:**
```tsx
// فقط للأدمن
{role === 'admin' && (
  <DropdownMenuItem onClick={...} className="text-destructive">
    <Trash2 ... />
    {t.common.delete}
  </DropdownMenuItem>
)}
```

---

## ملخص الصلاحيات النهائية

| الإجراء | Admin | Instructor |
|---------|-------|------------|
| عرض السيشنات | ✅ | ✅ |
| تسجيل الحضور | ✅ | ✅ |
| تحديد السيشن كمكتمل | ✅ | ✅ |
| تعديل الموضوع والملاحظات | ✅ | ✅ |
| تغيير تاريخ/وقت السيشن | ✅ | ❌ |
| حذف السيشن | ✅ | ❌ |
| إعادة جدولة المجموعة | ✅ | ❌ |
| توليد السيشنات | ✅ | ❌ |

---

## الملفات المتأثرة

| الملف | التغيير |
|-------|---------|
| `src/pages/GroupDetails.tsx` | إضافة useAuth وتقييد RescheduleDialog و EditSessionDialog للأدمن |
| `src/pages/Sessions.tsx` | إخفاء زر الحذف من الإنستراكتور |
