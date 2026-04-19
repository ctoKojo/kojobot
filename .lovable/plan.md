

# Final Implementation Plan: MVP-Safe Audit-Grade Accounting System

## معالجة الـ 4 ملاحظات الحرجة الأخيرة

### 1. RPC-Only Enforcement (Bulletproof Middleware)

**المشكلة**: لو أي bypass في الـ enforcement layer = النظام ينهار.

**الحل: 3 طبقات متراكبة (defense in depth)**

```text
Layer A — RLS صارم على الجداول المالية:
  CREATE POLICY "no_direct_access" ON payments USING (false) WITH CHECK (false);
  (نفس الشيء على expenses, salary_payments, journal_*, payroll_*)
  → service_role + authenticated كلهم محرومين من direct DML

Layer B — Session-context guard:
  - كل RPC مالي يبدأ بـ: PERFORM set_config('app.via_rpc', 'true', true);
  - Trigger BEFORE INSERT/UPDATE/DELETE على كل جدول مالي:
    IF current_setting('app.via_rpc', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'DIRECT_DML_FORBIDDEN: Use RPC % instead', TG_TABLE_NAME;
    END IF;
  - الـ setting بـ is_local=true → يبطل تلقائياً نهاية الـ transaction
  - حتى لو حد عمل SET app.via_rpc من client → RLS=false هيرفض

Layer C — Approved RPC registry:
  - جدول approved_financial_rpcs(rpc_name text PK, version int)
  - كل RPC مالي معتمد في الـ registry
  - Trigger يفحص current_query() يحتوي على RPC من الـ registry
  - منع طريق ثالث: لو RLS اتفك بالخطأ، الـ trigger هيمسك
```

**النتيجة**: 3 طبقات مستقلة. لازم 3 يفشلوا في نفس الوقت عشان bypass يحصل.

---

### 2. Materialized Views Refresh Strategy

**المشكلة**: لو الـ refresh مش مضبوط → أرقام outdated في close period = كارثة.

**الحل: Hybrid Refresh Pattern**

```text
استراتيجية مدروسة لكل MV:

mv_account_balances_monthly (الأهم):
  - REFRESH MATERIALIZED VIEW CONCURRENTLY في كل journal posting
  - عبر AFTER trigger على journal_entries (status changed to 'posted')
  - استخدام pg_advisory_xact_lock عشان مفيش race condition
  - تكلفة: ~100ms لكل posting لكنه مضمون

mv_aging_summary (متوسط الأهمية):
  - Incremental update عبر trigger على payments
  - Full refresh كل 15 دقيقة عبر cron
  - في close period: force refresh قبل take_snapshot

mv_payroll_totals (نادر الاستخدام):
  - Refresh on-demand فقط
  - في approve_payroll_run: REFRESH قبل ما تسجل الـ totals

في close_period (CRITICAL):
  Step 1: Lock financial_periods FOR UPDATE
  Step 2: REFRESH ALL materialized views CONCURRENTLY
  Step 3: Validate trial balance from refreshed MVs
  Step 4: Take snapshot من الـ MVs (مش من live tables)
  Step 5: Mark period closed + take snapshot

UI Indicator:
  - كل MV-based widget يعرض "Last refreshed: 2m ago"
  - زر manual refresh للـ admin
  - في close flow: progress bar للـ refresh
```

---

### 3. Real-Time Mismatch Detection (UI-First)

**المشكلة**: cron daily = فجوة 24 ساعة. المستخدم لازم يشوف mismatch فوراً.

**الحل: 3-tier detection system**

```text
Tier 1 — Inline checks (real-time):
  - بعد كل payment posting → trigger بيحسب expected balance vs cached
  - لو فيه فرق > 0.01 → INSERT INTO balance_alerts + إشعار فوري
  - في UI: notification bell badge أحمر للـ admin

Tier 2 — On-page validation (per-view):
  - كل ledger page (Customer/Employee) فيه validation hook
  - useBalanceIntegrity(accountId) hook يحسب الـ balance live من journal
  - مقارنة مع الـ cached balance
  - لو mismatch → red banner: "⚠️ Balance mismatch detected. [Rebuild]"

Tier 3 — Cron (fallback only):
  - Nightly comprehensive scan
  - يكتشف mismatches اللي فاتت Tier 1+2
  - يرسل summary email للـ admin

جدول balance_alerts:
  id, account_type (customer/employee), account_id,
  cached_balance, computed_balance, difference,
  detected_at, detected_by_method (trigger/page/cron),
  status (pending/acknowledged/rebuilt),
  rebuilt_at, rebuilt_by

UI Dashboard:
  /finance/integrity → real-time alerts panel
  - Active alerts (red)
  - Recent rebuilds (green)
  - Detection method stats
```

---

### 4. Installment-Based Aging Data Quality

**المشكلة**: aging يعتمد على `payments.installment_id` → لو data quality ضعيف، aging يبوظ silently.

**الحل: Strict Data Quality Framework**

```text
Step 1 — Schema enforcement:
  ALTER TABLE payments ADD COLUMN installment_id uuid;
  ALTER TABLE payments ADD CONSTRAINT installment_required_for_subscription
    CHECK (
      payment_type != 'subscription' 
      OR installment_id IS NOT NULL
    );

Step 2 — Backfill (one-time migration):
  RPC backfill_payment_installments():
    لكل payment بدون installment_id:
      - يلاقي subscription المتعلق
      - يطابق بأقرب installment بنفس المبلغ + لم يُدفع
      - لو طابق → يربط
      - لو فشل → يضعه في unresolved_payments table للمراجعة اليدوية

Step 3 — UI enforcement (PaymentDialog):
  - Dropdown إجباري "Apply to installment:"
  - يعرض كل installments المعلقة للطالب مرتبة بـ due_date
  - مفيش طريقة لتسجيل subscription payment بدون اختيار installment
  - Warning لو الـ amount != installment.amount

Step 4 — Data quality monitoring:
  Daily cron data_quality_check():
    - عدد payments بدون installment_id
    - عدد installments مدفوعة بدون matched payment
    - عدد payments بـ amount mismatch مع installment
  
  UI: /finance/data-quality
    - Real-time KPIs
    - One-click fixes (rematch / split / merge)
    - Block period close لو فيه > 0 unresolved

Step 5 — Aging RPC safety:
  get_aging_receivables يبدأ بـ:
    - فحص: هل فيه payments بدون installment_id؟
    - لو نعم → return error + count
    - في UI: "Cannot generate aging report. 12 payments need installment linking. [Fix Now]"
  → Fail loud, مش fail silent
```

---

## Phased Execution Plan (تنفيذ متدرج)

### Phase 0: Foundation Hardening (Week 1-2)
- RPC-only enforcement (3 layers)
- approved_financial_rpcs registry
- via_rpc session context pattern
- Test bypass attempts (security validation)

### Phase 1: Period Lock + Receipts (Week 3-4)
- financial_periods + state machine
- ENUMs + financial_period_month على الجداول
- PaymentMethodFields + ReceiptViewButton
- Receipt upload flow (insert→upload→attach)

### Phase 2: Accounting Core (Week 5-7)
- chart_of_accounts + payment_accounts
- journal_entries + lines + balance trigger
- Auto-posting from payments/expenses/salary
- Customer + Employee ledgers
- mv_account_balances_monthly + smart refresh
- Balance alerts (Tier 1+2)

### Phase 3: Payroll System (Week 8-9)
- payroll_runs + payroll_adjustments
- Approval workflow integration
- Backfill من salary_events
- Employee ledger reconciliation

### Phase 4: Data Quality + Aging (Week 10)
- installment_id + backfill
- Data quality monitoring page
- Aging report (fail-loud version)
- UI enforcement في PaymentDialog

### Phase 5: Reports + Snapshots (Week 11-12)
- Trial Balance + Income Statement + Balance Sheet + Cash Flow
- financial_snapshots (indexed columns + JSONB details)
- Read-from-snapshot logic
- close_period with full MV refresh

### Phase 6: Audit + Reopen (Week 13)
- financial_audit_log (partitioned)
- reopen_requests + dual approval
- Snapshot lineage (parent_snapshot_id)
- Audit Explorer UI

### Phase 7: Polish + Documentation (Week 14)
- E2E tests for all flows
- Performance benchmarks
- User documentation (Arabic)
- Accountant training guide

---

## ضمانات Production النهائية

| الضمانة | الآلية | Layers |
|---------|--------|--------|
| لا bypass للـ RPC | RLS=false + via_rpc trigger + RPC registry | 3 layers |
| MVs دائماً fresh | Inline refresh + on-demand + cron | 3 strategies |
| Mismatch فوري | Trigger + page hook + cron fallback | 3 tiers |
| Aging دقيق | Constraint + backfill + UI enforcement + monitoring + fail-loud | 5 controls |
| Snapshot = legal truth | Read-from-snapshot logic + immutability | strict |
| HR ↔ Accounting sync | Reconciliation RPC + close gate | enforced |
| Tamper detection | journal hash + audit log + alerts | comprehensive |

---

## القرارات المعمارية النهائية

✅ **Adopted**:
- 3-layer RPC enforcement (RLS + session context + registry)
- Hybrid MV refresh (inline critical, on-demand others, cron fallback)
- 3-tier mismatch detection (real-time UI + page + cron)
- Strict installment data quality (constraint + UI + monitoring + fail-loud)
- MVP-safe scope: 7 phases, 14 weeks
- Single Source of Truth per entity
- Snapshot = immutable legal truth
- Reopen = rare event with dual approval

❌ **Rejected (over-engineering)**:
- Dynamic GRANT/REVOKE
- Payroll versioning chains
- ltree lineage
- Multi-branch / fiscal year (Phase 2 future)
- Auditor role (admin + approval workflow كافي)

**النتيجة النهائية**: نظام محاسبي audit-grade قابل للتنفيذ في 14 أسبوع، بـ 3 layers حماية حقيقية، وبدون أي single point of failure في كل آلية حرجة.

