

# تحديث تاريخ الاشتراك تلقائياً - التصميم المركزي النهائي

## الفكرة
تاريخ بداية الاشتراك يتحدد تلقائياً من اول سيشن في المجموعة. المنطق كله في الـ Database عبر function واحدة.

---

## 1. Migration: تعديل الجدول + إنشاء الـ Functions

### تعديلات جدول `subscriptions`
- `ALTER COLUMN start_date DROP NOT NULL` - السماح بـ NULL مؤقتاً حتى يُسند الطالب لمجموعة
- `ALTER COLUMN end_date DROP NOT NULL` - نفس السبب
- الـ unique index الحالي على `student_id` موجود بالفعل ويكفي (مفيش soft delete فمش محتاجين partial index)

### Function 1: `assign_subscription_dates(p_student_id UUID, p_group_id UUID)`

```text
المنطق:
1. التحقق من ان المجموعة started فعلاً:
   SELECT has_started FROM groups WHERE id = p_group_id FOR UPDATE
   -> لو false: return { updated: false, reason: 'group_not_started' }

2. جلب اول session date:
   SELECT session_date FROM sessions WHERE group_id = p_group_id
   ORDER BY session_date LIMIT 1
   -> لو مفيش: RAISE EXCEPTION 'No sessions found'

3. قفل الاشتراك (row locking):
   SELECT id INTO v_sub_id FROM subscriptions
   WHERE student_id = p_student_id AND status = 'active' AND start_date IS NULL
   FOR UPDATE
   -> لو مفيش: return { updated: false, reason: 'no_pending_subscription' }

4. تحديث الاشتراك:
   UPDATE subscriptions SET
     start_date = v_first_date,
     end_date = v_first_date + 90,
     next_payment_date = (لو installment: v_first_date + (paid_installments * 30))
   WHERE id = v_sub_id

5. RETURN jsonb { updated: true, start_date, end_date }
```

- كل التواريخ DATE-based (مش timestamp) لتجنب مشاكل timezone
- الـ function نفسها atomic في Postgres (transaction واحدة)
- `FOR UPDATE` يمنع race conditions

### Function 2: `assign_subscription_dates_bulk(p_group_id UUID)`

```text
المنطق:
1. التحقق من ان المجموعة started
2. جلب اول session date
3. UPDATE set-based واحد (مش loop):
   UPDATE subscriptions s
   SET start_date = v_first_date,
       end_date = v_first_date + 90
   FROM group_students gs
   WHERE gs.group_id = p_group_id
     AND gs.is_active = true
     AND s.student_id = gs.student_id
     AND s.status = 'active'
     AND s.start_date IS NULL

4. تحديث next_payment_date للتقسيط في نفس الـ UPDATE
5. RETURN عدد الاشتراكات المحدثة
```

- عملية واحدة بدل loop - اسرع بكثير مع مجموعات كبيرة

---

## 2. تغييرات الملفات

### `src/pages/Students.tsx`
- **حذف** حقل `sub_start_date` من الـ form والـ UI
- **حذف** حساب `endDate`, `nextPaymentDate`
- إنشاء الاشتراك بـ `start_date: null`, `end_date: null`, `next_payment_date: null`
- عرض ملاحظة: "تاريخ البداية يتحدد تلقائياً عند إسناد الطالب لمجموعة"

### `src/pages/Groups.tsx` - `handleSaveStudents`
- بعد إضافة كل طالب جديد + لو المجموعة `has_started`:
  - استدعاء `supabase.rpc('assign_subscription_dates', { p_student_id, p_group_id })`
- لا يحسب اي تواريخ في الـ frontend

### `supabase/functions/start-group/index.ts`
- بعد إنشاء السيشنات وتحديث المجموعة:
  - استدعاء `adminSupabase.rpc('assign_subscription_dates_bulk', { p_group_id })`
  - استدعاء واحد بدل loop على كل طالب

### `src/components/student/CreateSubscriptionDialog.tsx`
- **حذف** حقل تاريخ البداية اليدوي
- **حذف** حساب `endDate`, `nextPaymentDate`
- إنشاء الاشتراك بـ `start_date: null`, `end_date: null`
- بعد الإنشاء: لو الطالب في مجموعة بدأت -> استدعاء RPC
- لو لا: عرض رسالة "سيتحدد تلقائياً"

---

## 3. قواعد الـ Edge Cases

| الحالة | السلوك |
|--------|--------|
| مفيش sessions في المجموعة | الـ function ترفض (exception) |
| مفيش اشتراك نشط بـ `start_date = null` | ترجع `{ updated: false }` بدون exception |
| `start_date` محدد مسبقاً | لا يتغير (الشرط `start_date IS NULL`) |
| المجموعة لم تبدأ بعد | ترجع `{ updated: false, reason: 'group_not_started' }` |
| طالب في مجموعتين | اول مجموعة تبدأ هي اللي تحدد التاريخ |
| Race condition (إسناد متزامن) | `FOR UPDATE` يضمن function واحدة بس تكسب |

---

## ملخص التغييرات

| الملف | نوع التغيير |
|-------|-------------|
| Migration SQL | `ALTER` عمودين + function `assign_subscription_dates` + function `assign_subscription_dates_bulk` |
| `src/pages/Students.tsx` | حذف حقل التاريخ، إنشاء اشتراك بـ null dates |
| `src/pages/Groups.tsx` | استدعاء RPC بعد إسناد طالب لمجموعة بدأت |
| `supabase/functions/start-group/index.ts` | استدعاء `assign_subscription_dates_bulk` بدل loop |
| `src/components/student/CreateSubscriptionDialog.tsx` | حذف التاريخ اليدوي + استدعاء RPC لو في مجموعة بدأت |

