

# خطة: قفل حساب الطالب لحين تجديد الاشتراك (Payment Lock)

## الفكرة

لما الطالب يعدي المستوى ويضغط "ترقية" عبر `student_choose_track_and_upgrade`، النظام يقفل حسابه (`needs_renewal = true`) لحد ما الريسيبشن/الأدمن يعمل اشتراك جديد.

## الخطوات

### 1. Migration: إضافة `needs_renewal` + تعديل RPC

**Schema:**
- `ALTER TABLE profiles ADD COLUMN needs_renewal boolean DEFAULT false`

**تعديل RPC `student_choose_track_and_upgrade`:**
- إضافة سطر واحد بعد `UPDATE profiles SET level_id = ...`:
  ```sql
  UPDATE profiles SET level_id = v_next_level_id, needs_renewal = true, updated_at = now()
  WHERE user_id = v_student_id;
  ```
- يتم دمجهم في UPDATE واحد (مش overwrite)

### 2. صفحة `RenewalRequired.tsx`

صفحة جديدة شبه `AccountSuspended.tsx`:
- أيقونة نجاح (مش تحذير) — "مبروك نجحت!"
- رسالة: "محتاج تجدد اشتراكك للمستوى الجديد"
- معلومات تواصل + زر Sign Out
- RTL/LTR support

### 3. تعديل `ProtectedRoute.tsx`

- إضافة `needsRenewal` state
- في fetch الطالب: جلب `needs_renewal` مع `level_id` من profiles
- **ترتيب الأولوية في الـ checks:**
  1. `needs_renewal = true` → `/renewal-required`
  2. `isSuspended = true` → `/account-suspended`
  3. `hasLevel = false` → `/placement-gate`
- إضافة `/renewal-required` في `STUDENT_ALLOWED_WITHOUT_LEVEL`

### 4. تعديل `CreateSubscriptionDialog.tsx`

عند إنشاء اشتراك (خصوصاً renewal):
- بعد insert الاشتراك، تنفيذ:
  ```ts
  await supabase.from('profiles').update({ needs_renewal: false }).eq('user_id', studentId)
  ```
- invalidate الكاش في ProtectedRoute (عن طريق reset `statusCache.fetchedAt`)

### 5. تعديل `App.tsx`

- إضافة lazy import لـ `RenewalRequired`
- إضافة route: `/renewal-required` بدون `ProtectedRoute` (زي `/account-suspended`)

## ملخص الملفات

| الملف | التعديل |
|-------|---------|
| Migration | `needs_renewal` column + RPC update |
| `src/pages/RenewalRequired.tsx` | **جديد** |
| `src/components/ProtectedRoute.tsx` | check `needs_renewal` بأعلى priority |
| `src/components/student/CreateSubscriptionDialog.tsx` | reset `needs_renewal = false` |
| `src/App.tsx` | إضافة route `/renewal-required` |

