
## Plan: Final Hardening Patch — 3 Critical Gaps

### الهدف
سد آخر 3 ثغرات تقنية في الـ ERP layer:
1. **Transaction Coordinator** لمنع partial failures بين cash/journal/payment
2. **Snapshot Router enforcement** على مستوى DB (مش convention)
3. **Close-period serialization** بـ advisory locks لمنع race conditions

---

### Gap 1: Transaction Coordinator (Migration 1)

**المشكلة الحقيقية**: لو RPC سجل payment ثم journal entry ثم cash movement، أي فشل في الوسط = inconsistent state (RPC بترجع exception لكن partial side-effects ممكن تكون اتسجلت لو في nested savepoints غلط).

**الحل**:
1. إنشاء **single orchestrator RPC** لكل عملية مالية مركبة:
   - `coordinate_payment_transaction(p_payment_data jsonb)` — يلف الـ 3 خطوات في savepoint واحد + rollback تلقائي
   - `coordinate_expense_transaction(p_expense_data jsonb)`
   - `coordinate_salary_payment_transaction(p_salary_data jsonb)`

2. كل coordinator:
   ```
   BEGIN
     SAVEPOINT step_payment;
     INSERT payment + return id;
     SAVEPOINT step_journal;
     INSERT journal_entry + lines (validated balanced);
     SAVEPOINT step_cash;
     INSERT cash_movement (if cash);
     -- لو أي خطوة فشلت → ROLLBACK TO outer savepoint
     -- + INSERT INTO transaction_failures للـ audit
   END
   ```

3. جدول جديد `transaction_failures`:
   - `id, coordinator_name, failed_at_step, input_payload, error_message, attempted_by, attempted_at`
   - للتشخيص بدون تأثير على الـ rollback

4. **منع** الـ RPCs القديمة (`record_payment_atomic`, etc.) من الاستدعاء المباشر — تتحول لـ internal helpers يستدعيهم الـ coordinator فقط.

5. تحديث `approved_financial_rpcs` — الـ coordinators بس هم اللي مسجلين، الباقي يصبح internal.

---

### Gap 2: Snapshot Router DB-Level Enforcement (Migration 2)

**المشكلة الحقيقية**: `get_report_source` helper بس convention. ممكن developer جديد يكتب RPC بدون استخدامه.

**الحل**:
1. **Trigger على مستوى الـ function metadata** — مستحيل تقنياً مباشرة، لكن البديل:

2. **Reporting RPC Registry** صارم:
   - جدول جديد `reporting_rpcs_registry`:
     - `rpc_name PK, must_use_router boolean, registered_by, registered_at`
   - كل reporting RPC لازم تتسجل
   - دالة `enforce_router_usage()` تـ scan الـ `pg_proc.prosrc` (source code) للـ RPCs المسجلة وتتأكد إنها تحتوي على `fetch_from_snapshot_or_compute` أو `get_report_source`
   - تشتغل كـ daily cron + قبل أي period close

3. **Defensive layer ثاني**: في كل reporting RPC، أول سطر:
   ```sql
   PERFORM public.assert_report_via_router(p_period_month);
   ```
   - الدالة دي تشيك `app.via_report_router = 'true'` في session context
   - الـ helper بـ `fetch_from_snapshot_or_compute` بيـ set الـ context
   - أي raw SQL مباشر = exception

4. **Daily scan job**: `scan_reporting_compliance()` يجري كل يوم ويـ alert الـ admin لو فيه RPC reporting مش مسجل أو مش ملتزم.

5. **Migration validator**: trigger على `pg_event_trigger` بـ DDL command end يفحص لو فيه CREATE FUNCTION جديد بـ "report" أو "balance" في اسمه ومش مسجل → warning notice في الـ logs.

---

### Gap 3: Close-Period Serialization (Migration 3)

**المشكلة الحقيقية**: `close_period_v2` لو اتنين admin استدعوها concurrently → ممكن double snapshots أو inconsistent gate results.

**الحل**:
1. **Advisory Lock مركزي** في بداية `close_period_v2`:
   ```sql
   PERFORM pg_advisory_xact_lock(
     hashtext('close_period_' || p_period_month::text)
   );
   -- هيستنى لو في close تاني شغال على نفس الفترة
   ```

2. **Lock على level أعلى** للعمليات الـ system-wide:
   - lock global `pg_advisory_xact_lock(99999)` لمنع أي period close بالتوازي مع period reopen
   - lock على `financial_periods` row بـ `SELECT ... FOR UPDATE NOWAIT` + clear error لو locked

3. **Lock duration tracking**:
   - جدول `period_close_locks`:
     - `period_month, locked_by, locked_at, released_at, status`
   - audit trail لكل محاولة close (نجحت/فشلت/timeout)
   - يكشف لو في admin بيحاول close متعدد

4. **Same logic لـ `reopen_period`**:
   - نفس الـ advisory lock
   - + check إن مفيش close attempt شغال

5. **UI feedback**:
   - لو الـ lock مأخوذ → exception واضح: `PERIOD_CLOSE_IN_PROGRESS by user X since Y`
   - الـ frontend يعرض toast "العملية قيد التنفيذ بواسطة admin آخر"

---

### Migration Plan

| # | الملف | الغرض |
|---|------|------|
| 1 | `gap1_transaction_coordinator.sql` | Coordinators + transaction_failures + savepoints |
| 2 | `gap2_snapshot_router_enforcement.sql` | Registry + assert_report_via_router + scanner |
| 3 | `gap3_close_period_serialization.sql` | Advisory locks + period_close_locks + UI errors |

**Total**: 3 migrations فقط — minimal delta كما طلبت.

---

### القرارات المعمارية النهائية

✅ **Adopted**:
- Single orchestrator pattern (mimicking distributed transaction coordinator)
- Defense-in-depth للـ snapshot router (registry + session context + scanner)
- pg_advisory_xact_lock لكل period operations
- Transaction failures table للـ debugging بدون كسر الـ atomicity
- DDL event trigger للـ proactive warnings

❌ **Rejected**:
- 2-Phase Commit (over-engineering لـ single DB)
- External coordinator service (Postgres كافي)
- Optimistic concurrency (advisory locks أصرم)

**النتيجة**: نظام ERP-grade مقفول بالكامل — لا partial failures، لا router bypass، لا race conditions في close.
