
# خطة إضافة إشعار للمدرب عند إسناد مجموعة جديدة له

## نظرة عامة
عند إنشاء مجموعة جديدة أو تغيير المدرب المسند لمجموعة موجودة، سيتم إرسال إشعار للمدرب الجديد لإعلامه بالمجموعة المسندة إليه.

---

## التعديلات المطلوبة

### 1. إضافة دالة جديدة في `notificationService.ts`

سيتم إضافة دالة `notifyGroupAssigned` لإشعار المدرب عند إسناد مجموعة له:

```typescript
// Notify instructor when group is assigned
async notifyGroupAssigned(
  instructorId: string, 
  groupName: string, 
  groupNameAr: string, 
  scheduleDay: string, 
  scheduleTime: string
) {
  return this.create({
    user_id: instructorId,
    title: 'New Group Assigned',
    title_ar: 'مجموعة جديدة مسندة إليك',
    message: `You have been assigned to group "${groupName}" - Schedule: ${scheduleDay} at ${scheduleTime}`,
    message_ar: `تم إسناد مجموعة "${groupNameAr}" إليك - الموعد: ${scheduleDay} الساعة ${scheduleTime}`,
    type: 'info',
    category: 'group',
    action_url: '/groups',
  });
}
```

### 2. تحديث `handleSubmit` في `src/pages/Groups.tsx`

سيتم تعديل دالة `handleSubmit` لتشمل:

**عند إنشاء مجموعة جديدة:**
- إرسال إشعار للمدرب المسند

**عند تعديل مجموعة:**
- التحقق إذا تغير المدرب المسند
- إذا تغير، إرسال إشعار للمدرب الجديد فقط

### 3. منطق العمل

```text
إنشاء مجموعة جديدة:
├── حفظ المجموعة في قاعدة البيانات
├── ✓ نجاح
│   └── إرسال إشعار للمدرب المسند
└── ✗ فشل
    └── عرض رسالة خطأ

تعديل مجموعة:
├── مقارنة instructor_id القديم بالجديد
├── إذا اختلف المدرب:
│   ├── حفظ التعديلات
│   └── إرسال إشعار للمدرب الجديد
└── إذا لم يختلف:
    └── حفظ التعديلات فقط (بدون إشعار)
```

---

## الملفات المتأثرة

| الملف | نوع التعديل |
|-------|------------|
| `src/lib/notificationService.ts` | إضافة دالة `notifyGroupAssigned` |
| `src/pages/Groups.tsx` | استدعاء الإشعار في `handleSubmit` |

---

## خطوات التنفيذ

1. **إضافة دالة الإشعار الجديدة** في `notificationService.ts`
2. **استيراد `notificationService`** في `Groups.tsx`
3. **تعديل `handleSubmit`**:
   - عند الإنشاء: إرسال إشعار للمدرب
   - عند التعديل: مقارنة المدرب القديم بالجديد، وإرسال إشعار إذا تغير
4. **اختبار الميزة** بإنشاء مجموعة جديدة وتغيير مدرب مجموعة موجودة
