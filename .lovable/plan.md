

# الخطة: تفعيل الخزنة المالية + ربط النظام المحاسبي بالحركات الحقيقية

## الهدف
تشغيل طبقة الـ double-entry accounting الموجودة بالفعل في DB، وربط كل دفعة/مصروف/راتب بقيد يومية تلقائي يحدّث رصيد الخزنة النقدية لحظياً، مع UI خزنة كامل.

---

## المخرجات (5 أجزاء)

### 1. ربط الحركات بدفتر اليومية تلقائياً (Migration)
- **Trigger `auto_post_payment_to_journal`** على `payments` بعد INSERT:
  - يولّد `journal_entry` بـ `source='payment'` و `voucher_no` تلقائي.
  - **سطرين**: Debit Cash/Bank/InstaPay/E-Wallet (حسب `payment_method` + `transfer_type` من `payment_accounts`) | Credit Subscription Revenue (4100).
  - يربط الـ line بـ `customer_account_id` للطالب.
  - يُنفّذ `status='posted'` فوراً (يستفيد من `b_validate_journal_balance_trg`).
- **Trigger `auto_post_expense_to_journal`** على `expenses`:
  - Debit حساب المصروف المناسب (5310/5320…) | Credit Cash أو Bank (حسب طريقة الدفع).
- **Trigger `auto_post_salary_to_journal`** على `salary_payments`:
  - Debit Salaries Expense (5100) | Credit Cash/Bank.
  - يربط الـ line بـ `employee_account_id`.

### 2. ضمان وجود subledger لكل طالب/موظف
- **Trigger على `profiles`** بعد إنشاء طالب → INSERT `customer_accounts` (control = 1210).
- **Trigger على `user_roles`** بعد منح دور instructor/reception → INSERT `employee_accounts` (control = 2110).
- **Backfill RPC `bootstrap_subledgers`** يملأ الـ accounts للطلاب/الموظفين الموجودين حالياً.

### 3. Backfill للحركات التاريخية (RPC)
- **`backfill_historical_journal_entries(p_dry_run boolean)`**:
  - يمر على كل `payments` و `expenses` (والـ salary_payments لو فيه) من الأقدم للأحدث.
  - يولّد journal entry لكل واحدة بـ `entry_date = payment_date/expense_date`.
  - Idempotent: يتخطى أي source_id موجود في `journal_entries` بالفعل.
  - يرجّع تقرير: `{ created_je, skipped, errors }`.
- يُستدعى مرة واحدة من زرار في صفحة الخزنة الجديدة (admin only).

### 4. صفحة الخزنة `/finance/treasury` — `src/pages/Treasury.tsx`
**4 كروت أرصدة لحظية** (تحسبهم real-time من `journal_entry_lines` لحسابات 1110, 1120, 1130, 1140):
- 💵 الخزنة النقدية (Cash on Hand)
- 🏦 الحساب البنكي (Bank)
- 📱 إنستاباي
- 💳 المحفظة الإلكترونية
- **إجمالي السيولة** (مجموع الأربعة)

**Tabs:**
- **Transactions**: كل الحركات الـ posted (payments in / expenses out / salary out) من `journal_entry_lines` joined مع `journal_entries` و `chart_of_accounts`. فلتر per-account, per-date-range, per-source.
- **Cash Reconciliation**: مقارنة الرصيد المحسوب (من الـ journal) vs العدّ الفعلي (admin يدخل رقم) → فرق + زرار "تسجيل عجز/زيادة" يخلق قيد adjustment.
- **Health Check**: حالة `balance_alerts` pending + زرار "Refresh `mv_account_balances_monthly`".

**زرار "Backfill Historical"** (admin فقط) يستدعي `backfill_historical_journal_entries`.

### 5. ربط الـ UI الموجود
- إضافة `/finance/treasury` في `src/App.tsx` (admin + reception).
- إضافة لينك في `AppSidebar.tsx` تحت قسم "Finance" بأيقونة 💰.
- إضافة Treasury card في `Dashboard` للـ admin/reception (الرصيد النقدي الحالي).

---

## ترتيب التنفيذ
1. Migration — auto-post triggers + subledger triggers + backfill RPC.
2. صفحة `/finance/treasury` كاملة + Sidebar link + Route.
3. تشغيل backfill يدوياً من زرار الصفحة (بعد الموافقة).
4. التحقق: `cash_on_hand` المحسوب من journal = 87,505 - 1,822 = **85,683 ج.م**.

---

## نقاط التحكم (لمنع المشاكل)
- كل الـ triggers `SECURITY DEFINER` + اسم alphabetical (`a_`/`b_`) لضمان الترتيب.
- Backfill idempotent بـ `WHERE NOT EXISTS (... source='payment' AND source_id=p.id)`.
- كل قيد يحترم `b_validate_journal_balance_trg` (Debit = Credit).
- `enforce_via_rpc` triggers الموجودة على `journal_entries` تتطلب الـ posting يحصل من داخل function — التريجر الجديد هيستخدم security definer function.

---

## الملفات المتأثرة
| ملف | النوع |
|-----|------|
| `supabase/migrations/<ts>_treasury_activation.sql` | جديد |
| `src/pages/Treasury.tsx` | جديد |
| `src/App.tsx` | تعديل (route) |
| `src/components/AppSidebar.tsx` | تعديل (link) |
| `src/components/dashboard/AdminDashboard.tsx` | تعديل (treasury card) |

---

## النتيجة بعد التنفيذ
- رصيد الخزنة يبان لحظياً ومش هيختلف عن الواقع أبداً.
- كل حركة جديدة (دفعة/مصروف/راتب) بتنزل auto في الـ journal.
- 52 payment + 9 expense القدام يتحولوا لقيود محاسبية صحيحة.
- النظام يبقى production-grade accounting بمعايير double-entry حقيقية.

