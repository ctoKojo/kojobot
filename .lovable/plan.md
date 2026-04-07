

# خطة إصلاح P0 الثلاثة

## P0-1: فك T6 المتوقفة

### الوضع الحالي
- T6: `last_delivered = 9`, `owed = 3`, `expected = 12`
- آخر سيشن: #11 (content 9, completed, 2026-03-30)
- **مفيش أي سيشن scheduled** — التريجر ما ولّدش السيشن التالية

### السبب
التريجر `auto_generate_next_session` فشل أو ما اشتغلش بعد إكمال session #11.

### الحل
إدراج سيشن جديدة (#12) بـ content_number = 10 ليوم الإثنين القادم (2026-04-13):

```sql
INSERT INTO sessions (group_id, session_number, content_number, status, session_date, session_time, duration_minutes)
VALUES (
  '4468ecc0-17fe-4722-a560-20395e4ca088',
  12, 10, 'scheduled', '2026-04-13', '14:00:00', 120
);
```

**ملف**: لا يوجد — عملية بيانات فقط (insert tool)

---

## P0-2: إصلاح grade-quiz للتسليم الفارغ

### المشكلة
السطر 82: `answerKeys.length === 0` يرفض أي تسليم بدون إجابات — ده بيكسر auto-submit لما الطالب ما يجاوبش قبل انتهاء الوقت.

### الحل
إزالة شرط `=== 0` والإبقاء على حد الـ 200 فقط:

```typescript
// Line 82 — BEFORE:
if (answerKeys.length === 0 || answerKeys.length > 200) {

// AFTER:
if (answerKeys.length > 200) {
```

**ملف**: `supabase/functions/grade-quiz/index.ts` — سطر 82

---

## P0-3: إصلاح بيانات الأقساط الناقصة

### الوضع الحالي
6 اشتراكات `active + installment` بدون `next_payment_date`:

| الطالب | remaining | installment | آخر دفع | next_payment_date المطلوب |
|--------|-----------|-------------|---------|---------------------------|
| Rodina | 50 | 1350 | 2025-11-08 | `2025-12-08` (متأخر) |
| Adam | 1050 | 1350 | 2025-08-01 | `2025-09-01` (متأخر) |
| Farooq | 2000 | 1000 | 2026-03-02 | `2026-04-02` (متأخر) |
| Yasser | 2000 | 1000 | 2026-03-03 | `2026-04-03` (متأخر) |
| Julia | 0 | 1000 | مكتمل | `NULL` ✓ (صح فعلاً) |
| Sherine | 0 | 1000 | مكتمل | `NULL` ✓ (صح فعلاً) |

### الحل
Julia و Sherine مش محتاجين إصلاح (remaining = 0, next = NULL = صح).

الأربعة الباقيين — الـ `next_payment_date` = آخر دفعة + 30 يوم:

```sql
-- Rodina: last paid 2025-11-08 → next = 2025-12-08
UPDATE subscriptions SET next_payment_date = '2025-12-08' WHERE id = 'ff276f22-790f-464e-b876-8a540431456d';

-- Adam: last paid 2025-08-01 → next = 2025-09-01
UPDATE subscriptions SET next_payment_date = '2025-09-01' WHERE id = '59355256-4229-4d18-835a-a92bc293195e';

-- Farooq: last paid 2026-03-02 → next = 2026-04-02
UPDATE subscriptions SET next_payment_date = '2026-04-02' WHERE id = '2c7e8f65-13f2-4cf2-8ab9-dae636082aa5';

-- Yasser: last paid 2026-03-03 → next = 2026-04-03
UPDATE subscriptions SET next_payment_date = '2026-04-03' WHERE id = '8ea27092-6812-48ac-a332-d08fe0322a52';
```

**ملاحظة**: Rodina و Adam متأخرين بشهور — `check-payment-dues` هيعلق حسابهم تلقائياً في أول تشغيل. لو مش عايز كده، ممكن نضع تاريخ مستقبلي بدلاً من ذلك.

**ملف**: لا يوجد — عمليات بيانات فقط (insert tool)

---

## ملخص التنفيذ

| الإصلاح | النوع | الملف |
|---------|-------|-------|
| T6 session جديدة | Data INSERT | insert tool |
| grade-quiz empty submit | Code edit | `supabase/functions/grade-quiz/index.ts` |
| 4 subscriptions next_payment_date | Data UPDATE | insert tool |

