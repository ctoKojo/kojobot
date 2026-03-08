
# خطة فصل مفاهيم السيشنات: Delivery Slot vs Curriculum Content vs Owed Sessions

---

## ✅ Phase 1: Schema + Backfill (مكتمل)

- `groups.last_delivered_content_number` INTEGER DEFAULT 0
- `groups.owed_sessions_count` INTEGER DEFAULT 0
- `sessions.content_number` INTEGER (nullable)
- Backfill: `content_number = session_number` لـ regular completed sessions فقط
- `last_delivered_content_number = MAX(content_number)` لكل مجموعة

## ✅ Phase 2 Step 1: Database Logic (مكتمل)

### القواعد المعتمدة:
1. `session_number` على makeup sessions يبقى للعرض و tracking فقط
2. `content_number` هو المرجع الحقيقي للمحتوى
3. `curriculum lookup` يعتمد على `content_number`
4. `level progress` يعتمد على `last_delivered_content_number`
5. **Level completion** = `last_delivered_content_number >= expected_sessions_count AND owed_sessions_count <= 0`
6. **Cancelled** regular session → `session_number + 1` + `owed_sessions_count += 1`
7. **Unique index** يمنع تكرار `session_number` لـ regular sessions فقط

### Trigger Execution Order (AFTER UPDATE on sessions):
1. `a_assign_content_on_complete` — يعيّن `content_number` + يحدث group counters (مع FOR UPDATE)
2. `on_session_status_change` — يولّد السيشن التالية (cancelled → +1 + owed++)
3. `trg_check_level_completion` — يتحقق من اكتمال المستوى (يقرأ الحالة المُحدّثة)

### Functions Modified:
- `assign_content_number_on_completion()` — **جديدة** — idempotency guard + FOR UPDATE + atomic group update
- `auto_generate_next_session()` — **معدّلة** — cancelled يولّد +1 + owed++ + stop condition جديد
- `check_students_level_completion()` — **معدّلة** — يستخدم القاعدة الجديدة بدل عد السيشنات
- Unique Index — **معدّل** — بدون استثناء cancelled

---

## ✅ Phase 2 Step 2: Edge Functions (مكتمل)

### Files Modified:
- `start-group/index.ts` — يضبط `last_delivered_content_number = starting_session_number - 1` + `owed_sessions_count = 0` + يعين `content_number` للـ completed sessions
- `populate-completed-sessions/index.ts` — يعين `content_number` للسيشنات الناقصة + يفلتر `is_makeup = false`
- `get-session-pdf-url/index.ts` — يستخدم `content_number` (مع fallback لـ `session_number`) لـ curriculum lookup

### No Changes Needed:
- `auto-complete-sessions` — التريجر `a_assign_content_on_complete` يتولى `content_number` assignment تلقائياً
- `generate-sessions` — fallback function يتعامل مع session_number فقط
- `reschedule-sessions` — scheduling فقط
- `session-reminders` — notifications فقط
- `generate-quiz-questions` — يستخدم curriculum_sessions.id مباشرة (لا session_number lookup)

---

## 🔲 Phase 2 Step 3: Frontend (قادم)

- `SessionDetails.tsx` — curriculum lookup بـ `content_number`
- `MySessions.tsx` — نفس التعديل
- `GroupDetails.tsx` — level progress بـ `last_delivered_content_number`
- `Sessions.tsx` — عرض + sorting
