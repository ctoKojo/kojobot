

# تقرير Audit شامل — Cross-Module System Orchestration

## الهدف
تغطية الـ 30-40% المتبقية التي لم يغطها التقرير الأول، مع التركيز على التفاعل بين الـ modules والـ permissions والـ notifications والامتحانات والمالية.

---

## 1. نظام الإشعارات — Full Lifecycle Audit

### مصادر توليد الإشعارات (Notification Origins)

| المصدر | النوع | Deduplication |
|--------|-------|---------------|
| `check-payment-dues` | payment suspension + warning | ✅ (أضفنا اليوم) |
| `session-reminders` | instructor session reminder | ✅ via `action_url` match |
| `compliance-monitor` | instructor/student warnings (6 أنواع) | ✅ via warning dedup |
| `auto-complete-sessions` | instructor warnings | ✅ (أضفنا اليوم) |
| `process-deductions` | financial deduction notice | ✅ via `deduction_applied` check |
| `grade-placement-exam` | admin notification | ❌ **BUG: لا يوجد dedup** |
| `reschedule-sessions` | student schedule change | ❌ **BUG: لا يوجد dedup** |
| `notificationService.ts` (client) | 14+ methods | ❌ **BUG: لا يوجد dedup — client-side** |
| `send-notification` edge fn | manual admin/instructor | ❌ **لا يوجد dedup** |

### المشاكل المكتشفة

**P1: `notificationService.ts` — كل methods بدون dedup**
- `notifyQuizAssigned`, `notifyAssignmentAssigned`, `notifyPaymentRecorded`, etc.
- لو الـ UI عملت retry أو الـ user ضغط مرتين → إشعارات مكررة
- **الحل**: إضافة `upsert` بـ unique key (user_id + category + action_url + DATE) أو check قبل insert

**P2: `grade-placement-exam` — admin notifications بدون dedup**
- لو الطالب submit مرتين (race condition) → كل admin يجيله إشعارين
- **الحل**: إضافة check بـ `attempt_id` في `action_url` أو `reference_id`

**P3: `reschedule-sessions` — bulk notification بدون dedup**
- لو admin ضغط reschedule مرتين → كل طالب يجيله إشعارين
- **الحل**: check بـ `action_url` + `created_at >= today`

**P4: Notification lifecycle ناقص**
- مفيش TTL أو auto-cleanup للإشعارات القديمة
- مفيش bulk mark-as-read
- مفيش notification preferences (الطالب مش يقدر يوقف نوع معين)

---

## 2. الامتحانات — Full Flow Audit

### Placement Exam (`draw-placement-exam` + `grade-placement-exam`)

**Drawing Algorithm**:
- Sections: A (basics), B (programming), C (tracks: software/hardware balanced 50/50)
- Dedup: يستبعد أسئلة المحاولات السابقة ✅
- Fallback: لو مفيش أسئلة كافية بعد الاستبعاد → يرجع للكل ✅
- Randomization: `Math.random() - 0.5` (Fisher-Yates أفضل لكن كافي)

**المشاكل المكتشفة**:

**P2: Race condition في `draw-placement-exam`**
- الطالب يفتح 2 tabs → Tab 1 يعمل attempt → Tab 2 يعمل attempt تاني
- الكود بيعمل check لـ `in_progress` attempt ✅ لكن بين الـ check والـ insert فيه race window
- الـ unique index على `(student_id) WHERE status = 'in_progress'` بيمسك ده ✅ (code 23505 handled)
- **الحكم: مغطى بالفعل** ✅

**P2: Fairness distribution**
- السحب random بالكامل — مفيش balancing على difficulty
- لو question bank فيه 3 سهلة و2 صعبة في section → ممكن طالب ياخد كلهم سهل
- **الحل**: إضافة `difficulty` column وbalancing في `drawSection`

**P1: Grading edge case — borderline students**
- `trackDiff <= trackMargin` → `needsManualReview = true` ✅
- `confidenceLevel === 'low'` → `needsManualReview = true` ✅
- **لكن**: مفيش mechanism لمتابعة الـ manual review — الأدمن لازم يدخل `placement-test-review` يدوياً
- **الحل**: إضافة dashboard widget أو notification reminder

**P3: Reattempt logic**
- `allow_retake` setting موجود ✅
- `max_attempts` محدد ✅
- **لكن**: مفيش cooldown period بين المحاولات — الطالب يقدر يحاول تاني فوراً لو مسموح
- **الحل**: إضافة `min_hours_between_attempts` في settings

### Final Exam

- يُدار عبر `level_progress` table + `FinalExams.tsx`
- Trigger `b_check_level_completion` بيحول الطالب لـ `awaiting_exam`
- **مشكلة**: مفيش auto-notification للأدمن عند وصول طالب لـ `awaiting_exam` — بيعتمد على الـ dashboard فقط
- **الحل**: trigger notification عند تغيير `level_progress.status` لـ `awaiting_exam`

---

## 3. الرواتب والخصومات — Step-by-Step Flow

### Salary Calculation Pipeline

```text
instructor_salary (base) 
  + bonus_events (manual)
  - warning_deductions (auto via process-deductions)
  - other deductions (manual)
  = net_amount (salary_month_snapshots)
```

### Deduction Rules Flow

```text
Session completed without action
  → compliance-monitor issues instructor_warning
  → Deduction rule matched (deduction_rules table)
  → performance_event created (type: deduction_pending)
  → process-deductions edge fn picks it up
  → salary_event inserted (warning_deduction)
  → performance_event marked as applied
  → Instructor notified
```

**المشاكل المكتشفة**:

**P1: Cancelled session + deductions**
- لو session اتعملت cancel بعد ما compliance-monitor أصدر warning
- الـ warning بيفضل `is_active = true` والخصم بيتطبق
- **مفيش mechanism لإلغاء warning عند cancel**
- **الحل**: عند تغيير session status لـ `cancelled` → auto-deactivate related `instructor_warnings`

**P2: Makeup sessions + salary**
- Makeup sessions مش مربوطة بالراتب أصلاً
- لو مدرب عمل makeup session → مفيش أي أثر مالي (لا bonus ولا overtime)
- **تقييم**: ده design decision مش bug — لكن لازم يكون واضح

**P2: `process-deductions` timing**
- بيستخدم `currentMonth` كـ `now().substring(0,7) + '-01'`
- لو الـ warning حصلت آخر يوم في الشهر والـ cron اشتغل أول يوم في الشهر التالي → الخصم يتسجل في الشهر الجديد مش الشهر اللي حصلت فيه المشكلة
- **الحل**: استخدام `event.created_at` للتحديد الشهر الصحيح

---

## 4. Permissions Deep Audit — Role × Action Matrix

### Route-Level Protection (App.tsx)

| Route | Admin | Instructor | Student | Reception |
|-------|-------|------------|---------|-----------|
| `/students` | ✅ | ❌ | ❌ | ✅ |
| `/instructors` | ✅ | ❌ | ❌ | ❌ |
| `/finance` | ✅ | ❌ | ❌ | ✅ |
| `/student/:id` | ✅ | ✅ | ❌ | ✅ |
| `/instructor/:id` | ✅ | ❌ | ❌ | ❌ |
| `/deduction-rules` | ✅ | ❌ | ❌ | ❌ |
| `/settings` | ✅ | ❌ | ❌ | ❌ |
| `/session/:id` | ✅ | ✅ | ✅ | ✅ (all roles) |

### المشاكل المكتشفة

**P1: Instructor sees all students in `/student/:id`**
- Route allows `instructor` role
- **لكن**: RLS on profiles restricts to group members (per memory)
- Frontend: instructor can type any student UUID in URL
- **Backend enforcement**: RLS policy on `profiles` should block — **needs verification**

**P1: Session details `/session/:id` — open to ALL roles**
- Student can see any session details by guessing UUID
- **Should be**: student only sees sessions for their group
- **Backend**: depends on `sessions` RLS — needs check

**P2: Reception can access `/finance`**
- By design: reception sees filtered finance (no revenue charts)
- **But**: the `Finance.tsx` component fetches ALL subscriptions without RLS filter
- Since reception can see the page, they see all financial data client-side
- **The filtering is UI-only** (hiding tabs/cards) — not backend enforced

**P2: `send-notification` edge function**
- Allows both `admin` AND `instructor` to send notifications to ANY user_id
- Instructor could send notification to admin impersonating the system
- **الحل**: instructor should only send to students in their groups

### Privilege Escalation Scenarios

**P1: `EditSubscriptionDialog` — client-side role check only**
- Financial fields disabled for reception via `role !== 'admin'` check in UI
- **But**: RLS on `subscriptions` table — does it restrict reception from UPDATE on financial columns?
- If not → reception can use browser devtools to bypass the UI restriction

**P2: `notificationService.ts` — runs client-side**
- Any authenticated user calling these functions directly could send notifications
- Uses the anon key — depends on RLS on `notifications` table
- **Need to verify**: RLS INSERT policy requires `user_id = auth.uid()` or allows any authenticated user

---

## 5. Data Ownership Across Modules

| Entity | Owner | Who Can Modify | Enforcement |
|--------|-------|----------------|-------------|
| Session | Group (→ Instructor) | Admin, Instructor (own groups) | RLS ⚠️ needs verify |
| Attendance | Session → Instructor | Instructor (insert only) | RLS + insert-only trigger ✅ |
| Subscription | Student | Admin (full), Reception (non-financial) | **UI-only** ❌ |
| Group schedule | Admin | Admin only | Route protection ✅ |
| Warnings (student) | Admin/Instructor/System | Issuer | RLS ⚠️ |
| Warnings (instructor) | System/Admin | System (auto), Admin (manual) | Service role ✅ |

---

## 6. Concurrency — System-Wide Analysis

| Operation | Concurrency Risk | Current Protection | Status |
|-----------|-----------------|-------------------|--------|
| Session completion | Duplicate trigger | Advisory lock ✅ | **Safe** |
| Payment recording | Double payment | None | **⚠️ P1** |
| Placement exam draw | Duplicate attempt | Unique index + 23505 check ✅ | **Safe** |
| Quiz submission | Double submit | Status check (in_progress) | **⚠️ P2** |
| Subscription update | Concurrent edits | None | **⚠️ P2** |
| Notification insert | Duplicate | Partial (some edges) | **⚠️ P2** |

**P1: Payment recording — no optimistic locking**
- Admin opens payment dialog → another admin records payment → first admin submits
- Result: double payment, overpayment
- `paid_amount` updated with stale value
- **الحل**: use `UPDATE ... SET paid_amount = paid_amount + X` instead of reading and setting

**P2: Quiz submission race**
- Student opens 2 tabs → submits in both → `grade-quiz` checks `status = 'in_progress'` but both pass
- **الحل**: `UPDATE ... SET status = 'submitted' WHERE status = 'in_progress' RETURNING id` — if 0 rows → reject

---

## 7. Cross-Module Interactions

### Payment → Group Access

```text
payment overdue → check-payment-dues → is_suspended = true
  → ProtectedRoute reads is_suspended → redirects to /account-suspended
  → Student loses all access
```
**✅ Working correctly**

### Attendance → Finance + Progress

```text
attendance recorded → a_assign_content trigger → advances content
  → b_check_level_completion → may set awaiting_exam
  → BUT: no financial impact from attendance (no per-session billing)
```
**⚠️ Gap**: Instructor no-show (no attendance recorded) → `compliance-monitor` warns → `process-deductions` deducts. **But** if session was cancelled (academy closure), the deduction still applies because compliance-monitor checks ALL completed sessions historically.

### Session Completion → Exam Eligibility

```text
student completes required sessions → b_check_level_completion
  → level_progress.status = 'awaiting_exam'
  → Student removed from group (is_active = false)
  → FinalExams page shows them
```
**⚠️ Gap**: What if student has overdue payment when reaching `awaiting_exam`?
- They're suspended AND awaiting exam simultaneously
- `ProtectedRoute` sends them to `/account-suspended`
- Admin can't schedule their exam because they can't see the student's page?
- **Actually**: Admin can still see FinalExams page — student just can't access it
- **But**: UX gap — no indicator on FinalExams page that student is suspended

---

## 8. Edge Cases Cross-Module

### Case 1: Student absent + payment overdue + group ended
- Student misses sessions → reaches session limit → `awaiting_exam`
- Payment overdue → `is_suspended = true`
- **Result**: student stuck — can't take exam (suspended) and can't attend (removed from group)
- **Need**: manual admin intervention path

### Case 2: Student in multiple groups
- System supports `group_students` many-to-many
- **But**: `ProtectedRoute` only checks ONE subscription (latest active)
- If student has 2 subscriptions, one suspended → they're blocked from everything
- **الحل**: check subscription linked to active group, not just latest

### Case 3: Subscription expired during ongoing session
- `ProtectedRoute` checks `is_suspended` not `status = 'expired'`
- Expired subscription → student can still access everything
- **By design**: `is_suspended` is the access control flag, not `status`
- **But**: expired students shouldn't access new content?

### Case 4: Reschedule during exam eligibility
- Student reaches `awaiting_exam` → removed from group
- Admin reschedules group → notification sent to active students only
- **No issue** — student is already removed

---

## 9. Frontend Logic Consistency Across Roles

### Instructor Dashboard Flows
- Dashboard → Groups → Sessions → Session Details → Record Attendance / Assign Quiz / Assign Assignment
- **Gap**: No breadcrumb or back navigation consistency
- **Gap**: Instructor can see `session/:sessionId` for any session (route allows all roles)

### Reception Workflows
- Dashboard → Students → Create Student → Create Subscription
- Can see Finance tab with filtered stats ✅
- **Gap**: Reception can see `/instructor-schedule` for any instructor — is this intended?
- **Gap**: Reception has no access to Leaderboard in sidebar but route allows it — inconsistency
  - Sidebar shows Leaderboard for reception ✅ (line 131 + 231 isn't there for reception... wait, line 131 has `['admin', 'reception']`)
  - Actually: line 131 shows leaderboard under admin section with `roles: ['admin', 'reception']` but reception sidebar (line 213-243) **doesn't include leaderboard** — so the URL works but there's no nav link. **UX gap**.

### Admin Workflows
- **Gap**: No link to `ssot-health` page in sidebar — it's a hidden admin tool (URL only)

---

## 10. Logging و Observability

### Current Coverage

| Layer | Logging | Status |
|-------|---------|--------|
| Edge Functions | `console.log/error` | ✅ Basic |
| Activity Logs | `activityLogger.ts` | ⚠️ Partial — not all actions logged |
| Trigger chain | No logging | ❌ |
| Client errors | `errorHandler.ts` | ⚠️ Logs to console only |
| System health | `system_health_metrics` | ✅ (compliance-monitor writes) |
| Performance events | `performance_events` table | ✅ |

### المشاكل المكتشفة

**P2: Trigger chain — zero observability**
- `a_assign_content`, `b_check_level_completion`, `on_session_status_change` — all SQL triggers
- No logging, no audit trail when they fire
- If a trigger fails silently → no way to know except checking data inconsistencies
- **الحل**: Add `RAISE NOTICE` or insert into an `event_log` table from triggers

**P2: `activityLogger` — incomplete coverage**
- Logs: login, logout, create, update, delete, view, assign, submit, grade
- **Missing**: payment recording, subscription changes, warning dismissals, notification sends
- **الحل**: Add `logPayment`, `logSubscription`, `logWarning` convenience functions

**P3: Client error tracking**
- `ErrorBoundary` catches React crashes ✅
- But errors are only logged to console — no server-side tracking
- **الحل**: Send errors to a `client_errors` table or use `activity_logs` with type `'error'`

---

## ملخص الأولويات

### P0 (Critical — Fix Immediately)
1. Payment recording concurrency — use atomic `paid_amount = paid_amount + X`
2. Compliance-monitor scanning ALL historical sessions — needs date boundary

### P1 (High — Fix This Sprint)
3. `notificationService.ts` — add dedup to all client-side methods
4. Cancelled session should deactivate related instructor warnings
5. `process-deductions` month assignment — use event date not current date
6. Instructor send-notification scope — restrict to own group students
7. Subscription edit — backend enforcement for reception role

### P2 (Medium — Plan for Next Sprint)
8. Quiz submission race condition — atomic status flip
9. Placement exam difficulty balancing
10. `awaiting_exam` auto-notification to admin
11. Trigger chain observability (event_log table)
12. Activity logger coverage expansion
13. Reception leaderboard nav link missing
14. `ssot-health` nav link for admin

### P3 (Low — Backlog)
15. Notification lifecycle (TTL, preferences)
16. Placement exam cooldown period
17. Client error server-side tracking
18. Notification cleanup/archival

---

## خطة التنفيذ المقترحة

### Phase 1: P0 Fixes (يوم واحد)
- Fix payment atomicity in `Finance.tsx` and `PaymentTrackerTab.tsx`
- Add date boundary to `compliance-monitor` session queries (`.gte('session_date', thirtyDaysAgo)`)

### Phase 2: P1 Fixes (2-3 أيام)
- Add dedup wrapper to `notificationService.ts`
- Add trigger/RPC to deactivate warnings on session cancel
- Fix `process-deductions` month logic
- Scope `send-notification` to instructor's groups
- Add RLS column-level check or RPC for subscription financial updates

### Phase 3: P2 Improvements (أسبوع)
- Quiz atomic submission
- Placement difficulty metadata
- Event log table + trigger logging
- Activity logger expansion
- UI nav fixes

