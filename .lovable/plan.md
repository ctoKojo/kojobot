

# اصلاح تاريخ بداية الاشتراك - بيانات حقيقية

## المشكلة المكتشفة

عند بدء مجموعة من سيشن متقدم (مثلا سيشن 3)، النظام ينشئ سيشنات وهمية مرجعة للخلف. دالتي `assign_subscription_dates` و `assign_subscription_dates_bulk` تاخد اقدم سيشن كبداية اشتراك، وده بيكون تاريخ وهمي.

**مثال جوليا (بيانات حقيقية Live):**
- المجموعة T3 بدأت يوم **2026-02-27** من سيشن رقم 3
- السيشنات الوهمية: سيشن 1 = 2026-02-13، سيشن 2 = 2026-02-20
- بداية الاشتراك اتسجلت **2026-02-13** بدل **2026-02-27**

**19 طالب متأثرين** في المجموعات: T1, T2, T3, T4, T5, T6, T9, T10, T13, T16, T17, T23, T24, T38

## الحل

### 1. Migration: تعديل الدالتين

تغيير مصدر تاريخ البداية من:
```text
SELECT session_date INTO v_first_date
FROM sessions WHERE group_id = p_group_id
ORDER BY session_date ASC LIMIT 1;
```
الى:
```text
SELECT start_date INTO v_first_date
FROM groups WHERE id = p_group_id;
```

### 2. اصلاح البيانات الحالية في Live

بعد نشر التعديل، يجب تشغيل كويري تصحيح يدويا في Cloud View > Run SQL (مع اختيار Live):

```text
UPDATE subscriptions s
SET start_date = g.start_date,
    end_date = g.start_date + 90
FROM group_students gs
JOIN groups g ON g.id = gs.group_id
WHERE gs.student_id = s.student_id
  AND gs.is_active = true
  AND g.starting_session_number > 1
  AND g.has_started = true
  AND s.status IN ('active', 'suspended')
  AND s.start_date != g.start_date;
```

هذا سيصحح بيانات الـ 19 طالب المتأثرين.

## التفاصيل التقنية

### الملفات المتأثرة
1. **Migration SQL جديدة** - تعديل `assign_subscription_dates` و `assign_subscription_dates_bulk` لاستخدام `groups.start_date`

### لا يوجد تعديلات فرونت اند
المشكلة بالكامل في الباك اند (دوال قاعدة البيانات).

