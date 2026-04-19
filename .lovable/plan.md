# نظام طرق الدفع وإيصالات التحويل (Production-Grade)

## الهدف
عند تسجيل أي **دفعة اشتراك / مصروف / راتب**، يحدد الأدمن أو الريسيبشن:
1. **طريقة الدفع**: كاش / تحويل
2. لو **تحويل** → نوع التحويل: تحويل بنكي / إنستا باي / محفظة إلكترونية
3. لو **تحويل** → رفع إيصال (صورة أو PDF) — **إجباري**

---

## 1) قاعدة البيانات — Migration

### ENUMs (بدل text عشان نمنع garbage data)
```sql
CREATE TYPE public.payment_method_type AS ENUM ('cash', 'transfer');
CREATE TYPE public.transfer_method_type AS ENUM ('bank', 'instapay', 'wallet');
```

### تحديث الجداول
- `payments`: إضافة `transfer_type transfer_method_type NULL` + `receipt_url text NULL`
  (`payment_method` موجود text → نحوّله لـ ENUM `payment_method_type`)
- `expenses`: إضافة `payment_method payment_method_type NOT NULL DEFAULT 'cash'` + `transfer_type` + `receipt_url`
- `salary_payments`: نفس الإضافات

### Validation Trigger (على الـ 3 جداول)
```sql
-- لو transfer لازم transfer_type + receipt_url
-- لو cash لازم transfer_type IS NULL و receipt_url IS NULL
```
SSOT للـ validation — الفرونت بيمنع UX سيء، التريجر بيمنع أي bypass.

### Backward Compatibility
كل السجلات القديمة `payment_method='cash'` تبقى valid (الأعمدة الجديدة nullable للـ cash).

---

## 2) Storage — Bucket خاص

### الإنشاء
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-receipts', 'payment-receipts', false);
```

### بنية المسار (مع versioning ضد الـ overwrite)
```
payments/{payment_id}/{uuid}.{ext}
expenses/{expense_id}/{uuid}.{ext}
salaries/{salary_id}/{uuid}.{ext}
```
كل ملف بـ `uuid` فريد → لو اترفع ملف بديل ما يعملش overwrite + ينفع نحتفظ بـ history.

### RLS Policies (Ownership-aware)
- **Admin / Reception**: read + write على كل الـ bucket
- **Parent**: read فقط للإيصالات اللي الـ `payment.subscription.student_id` بيرجع لطفل من أطفاله (join عبر `parent_students`)
- **Student**: read فقط للإيصالات اللي تخصه (`payments` تابعة لاشتراكه)
- **Instructor**: ممنوع
- باقي الـ folders (expenses/salaries) → admin/reception فقط

policies بتعتمد على `public.has_role()` + helper SECURITY DEFINER function للـ ownership check يعمل join على `payments → subscriptions → student_id` ويتحقق انها تخص الـ user الحالي.

---

## 3) Flow رفع الإيصال (يحل مشكلة "لا يوجد id قبل insert")

### Pattern: Insert-then-Upload-then-Update (atomic عبر RPC)

```
[1] Frontend: المستخدم يملأ الفورم + يختار ملف الإيصال (لسه ما اترفعش)
[2] Frontend → RPC `record_payment_atomic` (transfer_type + receipt_pending=true)
[3] Backend: insert payment → return payment_id (status='pending_receipt' لو transfer)
[4] Frontend: upload الملف على path = `payments/{payment_id}/{crypto.randomUUID()}.{ext}`
[5] Frontend → RPC `attach_payment_receipt(payment_id, receipt_path)`
[6] Backend RPC:
    - يتحقق إن الملف موجود فعلاً في الـ bucket (storage.objects lookup)
    - يتحقق إن الـ path يبدأ بـ `payments/{payment_id}/`
    - يتحقق إن الـ uploader = recorded_by (من auth.uid())
    - update payments.receipt_url + status='completed'
[7] لو فشل [4] أو [5] خلال 60 ثانية → cron يمسح الـ pending payments بدون receipt
```

نفس النمط لـ `expenses` و `salary_payments`.

**ملاحظة**: للحالات البسيطة (cash) → insert واحد بدون أي خطوة رفع.

---

## 4) RPC Updates

### `record_payment_atomic` (existing — extend)
بارامترات جديدة:
- `p_payment_method payment_method_type`
- `p_transfer_type transfer_method_type DEFAULT NULL`

السلوك:
- لو `cash` → ينشئ payment status='completed' فوراً
- لو `transfer` → ينشئ payment status='pending_receipt'، يرجع `payment_id` للفرونت يكمل رفع

### `attach_payment_receipt(p_payment_id, p_receipt_path)` (NEW)
- SECURITY DEFINER
- يتحقق من:
  1. الـ payment موجود + status='pending_receipt'
  2. الـ uploader = `recorded_by`
  3. `p_receipt_path` يبدأ بـ `payments/{p_payment_id}/` (منع path injection)
  4. الملف موجود فعلاً في `storage.objects` تحت `bucket_id='payment-receipts'`
  5. صاحب الملف في `storage.objects.owner` = `auth.uid()`
- بعد كل التحققات → update `receipt_url` + status='completed'

### نظائر للمصروفات والرواتب
- `attach_expense_receipt(p_expense_id, p_receipt_path)`
- `attach_salary_receipt(p_salary_payment_id, p_receipt_path)`

---

## 5) UI Changes

### Component مشترك جديد
`src/components/finance/PaymentMethodFields.tsx`
- props: `value`, `onChange`, `disabled`
- state: `{ payment_method, transfer_type, receipt_file, receipt_uploading }`
- يعرض:
  - Select كاش / تحويل
  - Select نوع التحويل (يظهر لو transfer)
  - File input للإيصال (يظهر لو transfer): jpg/png/webp/pdf، حد أقصى 5MB
- يـ expose helper `isValidForSubmit()` و `uploadReceipt(recordId, folder)` للـ parent

### Receipt Viewer مشترك
`src/components/finance/ReceiptViewButton.tsx`
- زرار "📎 الإيصال"
- **lazy**: ما يولّدش signed URL إلا عند الضغط (مش أثناء render الجدول)
- يفتح الملف في tab جديد عبر `supabase.storage.from('payment-receipts').createSignedUrl(path, 60)`

### نقاط الإدماج (6 dialogs)
| الملف | السياق |
|------|---------|
| `src/pages/Finance.tsx` (Payment Dialog) | تسجيل دفعة لاشتراك |
| `src/components/finance/PaymentTrackerTab.tsx` | تسجيل قسط مستحق |
| `src/components/student/CreateSubscriptionDialog.tsx` | الدفعة المسبقة عند إنشاء اشتراك |
| `src/features/students/components/StudentFormDialog.tsx` | الدفعة المسبقة عند إنشاء طالب |
| `src/components/finance/ExpensesTab.tsx` | إضافة مصروف |
| `src/components/finance/SalariesTab.tsx` | صرف راتب |

### عرض الإيصال (4 tables)
- `PaymentsHistory.tsx` (داخل بروفايل الطالب)
- `Finance.tsx` Recent Payments
- `ExpensesTab.tsx`
- `SalariesTab.tsx` payment records

كلها بتستخدم `<ReceiptViewButton path={record.receipt_url} />`.

---

## 6) ترتيب التنفيذ

```
1. Migration: ENUMs + columns + bucket + RLS policies + triggers + RPCs
2. PaymentMethodFields component
3. ReceiptViewButton component
4. ربط الـ 6 dialogs
5. عرض الإيصالات في الـ 4 tables
6. اختبار end-to-end (cash + كل أنواع التحويل + ownership على parent/student)
```

---

## 7) معايير القبول (Production-Grade Checklist)

- ✅ ENUMs بدل text (منع garbage)
- ✅ Versioned paths (uuid في المسار، منع overwrite)
- ✅ Insert→Upload→Attach flow (يحل مشكلة "no id before insert")
- ✅ Trigger validation كـ SSOT للـ business rule
- ✅ RPC `attach_*_receipt` يتحقق إن الملف فعلاً موجود وملك للـ uploader (منع path forgery)
- ✅ RLS ownership-aware للـ parent/student (join عبر student_id)
- ✅ Lazy signed URLs (performance)
- ✅ Backward compatible (السجلات القديمة nullable)
