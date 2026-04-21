# Memory: index.md
Updated: now

# Project Memory

## Core
- **Timezone**: Africa/Cairo is the absolute source of truth. Use `date-fns-tz` and `Luxon` constructed from numeric parts. Sessions expose `start_at`/`end_at` (TIMESTAMPTZ) computed by trigger.
- **Auth Rules**: Single `/auth` page. Strict role enforcement (Student=email, Parent=Google OAuth). Staff provisions accounts, no public signup.
- **LMS Integrity**: Curriculum-first approach. Quizzes/assignments assigned ONLY via 1-click in sessions to save snapshots.
- **DB Concurrency**: Enforce atomic operations via RPCs, advisory locks, partial updates (JSONB `?`), and alphabetical triggers (`a_`, `b_`).
- **Financials**: `subscriptions` enforces a partial unique index (`WHERE status = 'active'`). Revenue equals sum of `payments`.
- **UI Localization**: Use `unicodeBidi: 'plaintext'` & `dir="rtl"` for mixed Arabic/English text. `CodeBlock` must be LTR.
- **Session Rules**: Cannot mark complete or record attendance before Cairo start time. `content_number` drives progression, not `session_number`.
- **Identity Lock**: NEVER use `profiles.id` in queries. Always `profiles.user_id`. All profile ops via `@/lib/profileService`.
- **Lifecycle Lock**: Student state via `useStudentLifecycle` hook only. Banners are props-based. DB trigger enforces valid transitions.
- **Compliance**: Grace periods come from `system_settings.compliance_grace_periods` (admin-editable, versioned). Makeup sessions get `makeup_multiplier`-scaled grace.

## Memories

### Design & Constraints
- [Mixed Language Rendering](mem://style/mixed-language-rendering) — unicodeBidi plaintext and RTL for text, LTR for CodeBlocks
- [Mobile Data Density](mem://style/mobile-data-density) — Horizontal scrolling tabs for mobile UI
- [Enrollment Logic](mem://constraints/enrollment-logic) — Strict matching of online/offline, age, level. Transfer workflow for late additions
- [Session Completion Policy](mem://constraints/session-completion-policy) — DB triggers block attendance or completion before Cairo start time
- [Student Session Visibility](mem://constraints/student-session-visibility) — My Sessions restricted to active groups
- [Identity Design Lock](mem://constraints/identity-design-lock) — profiles.id forbidden, user_id only, profileService mandatory
- [Per-Student Assignment Isolation](mem://constraints/per-student-assignment-isolation) — quiz_assignments with student_id NOT NULL belong to one student only — group filter must exclude per-student rows from other users; TakeQuiz must guard

### Auth & Preferences
- [Auth Provisioning](mem://auth/provisioning) — Staff-only account creation for students/staff, no public signup
- [Unified Login Strategy](mem://auth/unified-login-strategy) — Single /auth route, role enforcement prevents cross-role login
- [Parent Account Approval](mem://features/parent-account-approval) — Admin approval workflow, security definer for Google metadata
- [Parents Portal Access](mem://features/parents-portal-access) — Google OAuth, linking codes, parent dashboard
- [Parent Linking Logic](mem://features/parent-linking-and-registration-logic) — Full name mapping, optional link on signup
- [Parent Linking System](mem://security/parent-linking-system) — Parent linking codes 12 chars, rate limit 5/min/IP

### Features: LMS & Curriculum
- [Educational Structure](mem://features/educational-structure) — Level order starts at 0, Arabic/English names
- [LMS Functionality](mem://features/lms-functionality) — Curriculum-first, 1-click assignments with snapshots
- [Curriculum Engine V2](mem://features/curriculum-engine-v2) — Immutable templates, OCR asset isolation
- [Curriculum Editing Workflow](mem://features/curriculum-editing-workflow) — Live editing, partial updates via JSONB
- [Curriculum Lifecycle](mem://features/curriculum-lifecycle-management) — Unpublish (RLS hide), soft delete, hard delete
- [Curriculum Roadmap](mem://features/curriculum-roadmap) — Age groups and Software/Hardware tracks
- [Branching Tracks](mem://features/branching-educational-tracks) — Software/Hardware split after Level 1
- [AI Curriculum Tools](mem://features/ai-curriculum-tools) — Gemini 2.5, Egyptian Arabic, Tiered Validation
- [Asynchronous Certificate System](mem://features/asynchronous-certificate-system) — PDFjs generation, Poppins SemiBold, title case
- [Placement Exam V2](mem://features/placement-exam-v2-comprehensive) — Dark theme, 13 questions, strict 50/50 hardware/software split
- [Student Content Visibility](mem://features/student-content-access-visibility) — Visual locks on unsubscribed videos, slides hidden
- [Landing Page CMS](mem://features/landing-page-cms-updated) — CMS via get_landing_content RPC, public client, NetworkFirst

### Features: Sessions & Attendance
- [Attendance Mode Logic](mem://features/attendance-mode-logic) — Dual online/offline with per-session overrides
- [Group Lifecycle](mem://features/group-lifecycle-and-session-generation) — Auto completion and archiving, auto_generate_next_session
- [Session Management Experience](mem://features/session-management-experience) — Auto-complete edge function after 60 mins
- [Online Attendance Tracking](mem://features/online-attendance-tracking) — Jitsi heartbeats (45s), thresholds for present/late/absent
- [Attendance Management](mem://features/attendance-management) — Insert-only policy, DB rejects duplicates
- [Evaluation Attendance](mem://features/evaluation-attendance-constraint) — Trigger validates individual attendance before eval insert
- [Academy Closures System](mem://features/academy-closures-system) — Skips holidays in schedule, advisory locking
- [Frozen Groups Enforcement](mem://features/frozen-groups-enforcement) — Stops next session generation, auto reschedules
- [Leave & Absence System](mem://features/leave-and-absence-excuse-system) — 24h notice required, generates makeups if approved
- [Makeup Sessions Infrastructure](mem://features/makeup-sessions-infrastructure) — Ledger pattern, auto-cancels obsolete makeups
- [Smart Student Transfer](mem://features/smart-student-transfer) — Canonical session tracking, atomic group transfers
- [Session Generation Repair Tool](mem://features/session-generation-repair-tool) — repair_orphaned_sessions RPC for broken timelines
- [Curriculum Session Mapping](mem://features/curriculum-session-mapping) — content_number vs session_number, advances only if completed

### Features: Assessments & Gamification
- [Automated Progression](mem://features/automated-student-progression) — Eval 60% + Exam 40%, 50% passing threshold
- [Scheduled Quiz Assignment](mem://features/scheduled-quiz-assignment-policy) — Assigned only during Cairo session time
- [Per-Student Quiz Windows](mem://features/per-student-quiz-windows) — Each student has individual quiz/assignment window based on their attended session (original or makeup)
- [Quiz Auto Submit Integrity](mem://features/quiz-auto-submit-integrity) — Atomic status flip, accepts partial/0 answers
- [Final Exam Standards](mem://features/final-exam-curriculum-standards) — Level 2 rubric, code tracing, system challenge
- [Final Exam Live Monitoring](mem://features/final-exam-live-monitoring) — Supabase Realtime tracking, heartbeat, extend time
- [Manual Grading System](mem://features/manual-grading-system) — Admin UI for open-ended exam questions
- [Final Exam Grading Auto-Completion](mem://features/final-exam-grading-auto-completion) — Auto status=graded + compute_level_grades_batch after fully_graded
- [Level Completion Flow](mem://features/level-completion-flow) — Final exams page, state persistence, awaiting_exam transition
- [Student Lifecycle State Machine](mem://features/student-lifecycle-state-machine) — DB trigger enforces transitions, unified hook, props-based banners
- [Gamification Hub](mem://features/gamification-hub) — Mobile-first bottom nav, Player Card, Map journey
- [Gamification Mechanics](mem://features/gamification-mechanics) — Level-scoped XP, events table, unique idempotency
- [Advanced Leaderboard](mem://features/advanced-leaderboard-system) — 6 scopes, DENSE_RANK, weighted average
- [Student Evaluation System](mem://features/student-evaluation-system) — Excludes absent students from eval grid

### Features: Finance & Subscriptions
- [Subscription Inquiry System](mem://features/subscription-inquiry-system) — /subscribe page replaces signup, honeypot, rate limited
- [Payment Gateway Integration](mem://features/payment-gateway-integration) — Paymob/Stripe, webhooks with HMAC verification
- [Subscription Financial Management](mem://features/subscription-financial-management) — Installment calcs, atomic payment record RPC
- [Financial Tracking](mem://features/financial-tracking-and-reporting) — Payment Tracker, installment source of truth, advance logic
- [Financial Reporting Logic](mem://features/financial-reporting-logic) — Revenue sum of payments, stacked bar chart projections
- [Parent Centric Finances](mem://features/parent-centric-finances) — Parents manage all child finances, hidden from student
- [Onboarding Flow](mem://features/onboarding-and-subscription-activation-flow) — Unified creation/subscription, activation bound to group start
- [Payment Lock Gate](mem://features/payment-lock-gate) — `needs_renewal` blocks access until re-subscribed
- [Subscription Level Management](mem://features/subscription-level-management) — Renew button appears at 'graded' status
- [Sibling Discount Automation](mem://features/sibling-discount-automation) — Auto percent discount via RPC
- [Salary Wallet System](mem://features/salary-wallet-system-updated) — Immutable ledger, 60-day check window
- [Salary Snapshot Initialization](mem://features/salary-snapshot-initialization) — Monthly generation for all active employees
- [Academic Financial Projections](mem://features/academic-financial-projections) — Cash flow projections with academic renewal predictors
- [ERP Final Hardening Gates](mem://features/erp-hardening-final-gates) — Transaction coordinators, snapshot router DB enforcement, close-period advisory locks

### Features: Roles & Communications
- [User Roles](mem://features/user-roles) — Reception staff have admin-parity for operations
- [Employee Termination Flow](mem://features/employee-termination-flow) — Admins only, bans auth, locks wallets, records reason
- [Instructor Access Policies](mem://features/instructor-access-policies) — Restricted to academic tabs, makeups hidden until parent confirms
- [Parent Portal Authority](mem://features/parent-portal-authority-transfer) — Parents confirm makeups/excuses, students are read-only
- [Parent Notification Experience](mem://features/parent-notification-experience) — Instant absence alerts to linked parents
- [Performance Management](mem://features/performance-management-and-sla) — Instructor SLA monitoring, 30-day progressive penalties
- [SLA Monitoring Automation](mem://features/sla-monitoring-automation) — Hourly cron jobs, Auth checks via CRON_SECRET
- [Compliance Warnings Rules V3](mem://features/compliance-warnings-rules) — Settings-driven grace, makeup-aware multiplier, end_at from DB, trace_id+settings_version per warning, anti-spam dedup, auto-resolve triggers, scan_runs telemetry
- [AI Chatbot Kojo](mem://features/ai-chatbot-kojo) — Socrates style, silent Balance Guard on 402 errors

### Logic & Architecture
- [Session Counters Integrity](mem://logic/session-counters-integrity) — last_delivered vs owed_sessions calculation
- [Group Timeline Consistency](mem://logic/group-timeline-consistency) — Groups starting > 1 auto-backfill 1 to N-1 as completed
- [Automated Task Idempotency](mem://logic/automated-task-idempotency) — 24h checks before notifications/penalties
- [Content Progression Guard](mem://logic/content-progression-guard) — Prevents curriculum loops during auto-generation
- [Progression Integrity Fix](mem://logic/progression-integrity-fix) — COUNT DISTINCT for level completion to avoid race conditions
- [Evaluation Scoring](mem://logic/evaluation-scoring-calculation) — Dynamic scaling, ignores missing assignments
- [Subscription Renewal](mem://logic/subscription-renewal-integrity) — Forced closure of old subs before inserting new
- [Cron Auth Vault Fallback](mem://logic/cron-auth-vault-fallback) — Edge Functions called from pg_cron must use verify_cron_token RPC fallback to handle env desync
- [Data Visibility Filtering](mem://features/data-visibility-filtering) — is_auto_generated flag hides dummy backfill data

### Tech Stack
- [Security Hardening](mem://tech-stack/security-hardening) — RLS policies, HIBP passwords, exceljs
- [DB Concurrency](mem://tech-stack/database-concurrency-and-atomicity) — Alphabetical triggers, Advisory Locks, central RPCs
- [Curriculum Quiz Integration](mem://tech-stack/curriculum-quiz-integration) — FOR UPDATE locks, assignment snapshots
- [Session Level Binding](mem://tech-stack/session-level-binding) — level_id filters grades in mixed groups
- [Edge Function Optimization](mem://tech-stack/edge-function-optimization) — Sequential loops, circuit breakers, chunked processing
- [Timezone Architecture](mem://tech-stack/timezone-architecture-cairo) — Africa/Cairo, date-fns-tz, Luxon
- [Dual Timezone Display](mem://features/dual-timezone-display) — IANA timezone detection, Cairo ref for non-Egyptians
- [Quiz Content Security](mem://tech-stack/quiz-content-security) — Read-only RLS for assigned quizzes
- [Frontend Performance Caching](mem://tech-stack/frontend-performance-caching) — 60s module cache for auth state
- [Transactional Email System](mem://tech-stack/transactional-email-system) — Dedicated kojobot subdomain
- [Subscription History Index](mem://tech-stack/subscription-history-index) — Partial unique index for active subs
