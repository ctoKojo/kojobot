

# خطة تنفيذ شاملة — اختبار وتحسين لوجيك الموقع

## نتائج الفحص الفعلي

| الفحص | النتيجة |
|-------|---------|
| `chatbot_rate_limits` — RLS بدون policies | **مؤكد** — الجدول محظور تماماً |
| Duplicate index على sessions | **مؤكد** — index قديم زائد |
| Sessions completed بدون attendance | **11 سيشن** — كلها T38 backfilled |
| content_number > expected | **0** — نظيف |
| awaiting_exam بدون final_exam_candidates | **0** — نظيف |
| طالب in_progress بدون active membership | **1** — طالب في T15 (عنده group تاني active) |
| Trigger order | **آمن** — `a_` < `on_` < `trg_` أبجدياً |
| `auto-complete-sessions` batch update | **خطر محتمل** — batch `.in()` بيفاير triggers بس ممكن race |
| `reschedule-sessions` date calc | **bug** — بيحسب date من `session_number - 1` مش من ترتيب فعلي |

---

## Phase 1: Database Migration — إصلاحات فورية

### Migration واحدة تعمل 4 حاجات:

**1. حذف Index الزائد**
```sql
DROP INDEX IF EXISTS idx_sessions_group_session_number_unique;
```

**2. إضافة RLS policies لـ `chatbot_rate_limits`**
```sql
CREATE POLICY "Users can insert own rate limits"
ON chatbot_rate_limits FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own rate limits"  
ON chatbot_rate_limits FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update own rate limits"
ON chatbot_rate_limits FOR UPDATE TO authenticated
USING (user_id = auth.uid());
```

**3. تحويل الـ 3 triggers لـ trigger orchestrator واحد (حل مشكلة الترتيب نهائياً)**

بدل 3 triggers منفصلين → function واحدة `session_status_orchestrator()` بتنادي الـ 3 خطوات بالترتيب:
```sql
CREATE OR REPLACE FUNCTION session_status_orchestrator()
RETURNS trigger AS $$
BEGIN
  -- Step 1: assign content (only on completion)
  PERFORM assign_content_logic(NEW, OLD);
  -- Step 2: check level completion
  PERFORM check_level_completion_logic(NEW, OLD);
  -- Step 3: generate next session
  PERFORM generate_next_session_logic(NEW, OLD);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

الـ 3 functions الأصلية تتحول لـ regular functions (مش triggers) وتتنادى من الـ orchestrator. Trigger واحد بس على sessions.

**4. إصلاح T15 orphan**
```sql
UPDATE group_student_progress 
SET status = 'dropped', updated_at = now()
WHERE student_id = 'cfd79ba3-...' 
AND group_id = '0723fa56-...'  -- T15 (inactive)
AND status = 'in_progress';
```

---

## Phase 2: Edge Function Fixes — الكود الفعلي

### Fix 1: `auto-complete-sessions` — تحويل batch لـ sequential

**المشكلة**: Batch `.in()` update بيفاير triggers لكل row بس ممكن race conditions لأن كل trigger بيشوف نفس الـ snapshot.

**الحل**: تحويل لـ loop update واحد واحد:
```typescript
// BEFORE (خطر):
await supabase.from("sessions").update({ status: "completed" }).in("id", completedIds);

// AFTER (آمن):
for (const id of completedIds) {
  await supabase.from("sessions").update({ status: "completed" }).eq("id", id);
}
```

### Fix 2: `reschedule-sessions` — إصلاح حساب التاريخ

**المشكلة**: Line 126 — `weekOffset = (session.session_number - 1) * 7` — ده غلط لأن session_number مش بالضرورة متسلسل (لو فيه cancelled sessions).

**الحل**: استخدام index في الـ loop بدل session_number:
```typescript
for (let i = 0; i < futureSessions.length; i++) {
  const weekOffset = i * 7;  // sequential index, not session_number
  const newDate = new Date(startDate);
  newDate.setDate(newDate.getDate() + weekOffset);
  // ...
}
```

### Fix 3: `generate-sessions` — إضافة boundary check

**المشكلة**: مفيش check على content limit — ممكن يولد sessions تجاوز المنهج.

**الحل**: إضافة check قبل الـ insert:
```typescript
// Get level expected count
const { data: levelData } = await adminSupabase
  .from('groups').select('last_delivered_content_number, owed_sessions_count, levels(expected_sessions_count)')
  .eq('id', group.id).single();

const expected = levelData?.levels?.expected_sessions_count ?? 12;
const delivered = levelData?.last_delivered_content_number ?? 0;
const owed = levelData?.owed_sessions_count ?? 0;

if (delivered >= expected && owed <= 0) {
  skippedCount++;
  continue; // curriculum complete
}
```

### Fix 4: `compliance-monitor` — إزالة false positive warning

**المشكلة**: بيطبع "Unauthorized access attempt" في logs لأي request مش service role/cron — ده normal behavior مش security issue.

**الحل**: تحويل `console.warn` لـ `console.log` أو إزالته.

---

## Phase 3: Frontend — مفيش تغييرات مطلوبة

بعد الفحص:
- `GroupDetails` و `Groups` — بيستخدموا `last_delivered_content_number` مباشرة ✓
- `FinalExams` — 0 orphans ✓
- `StudentProfile` — متسق ✓

---

## Phase 4: Rollback Plan

كل تغيير database هيبقى في migration واحدة. لو حصلت مشكلة:

1. **Trigger rollback**: لو الـ orchestrator فيه bug — نرجع الـ 3 triggers الأصلية (الكود محفوظ في الـ migration كـ comment)
2. **Index**: الـ index القديم كان redundant — مفيش rollback مطلوب
3. **RLS**: policies جديدة — حذفها بسيط
4. **Edge Functions**: كل function يتعمل revert من git history

---

## ملخص التنفيذ

| الخطوة | الملفات | النوع |
|--------|---------|-------|
| Migration | `supabase/migrations/new.sql` | DB: حذف index + RLS + trigger orchestrator + T15 fix |
| auto-complete-sessions | `supabase/functions/auto-complete-sessions/index.ts` | Edge: sequential update |
| reschedule-sessions | `supabase/functions/reschedule-sessions/index.ts` | Edge: fix date calc |
| generate-sessions | `supabase/functions/generate-sessions/index.ts` | Edge: boundary check |
| compliance-monitor | `supabase/functions/compliance-monitor/index.ts` | Edge: remove false warning |

---

## تفاصيل تقنية — ترتيب التريجرز

**الوضع الحالي**: PostgreSQL بيفاير AFTER UPDATE triggers أبجدياً:
```text
a_assign_content_on_complete  → أولاً (يبدأ بـ a)
on_session_status_change      → ثانياً (يبدأ بـ o)  
trg_check_level_completion    → ثالثاً (يبدأ بـ t)
```

**المشكلة**: الترتيب الصح المطلوب هو:
```text
1. assign_content  → يحدث groups.last_delivered
2. check_level     → يقرأ last_delivered (لازم يكون محدّث)
3. generate_next   → يقرأ last_delivered + owed
```

الترتيب الأبجدي الحالي بيحط `on_session_status_change` (generate_next) **قبل** `trg_check_level_completion` — ده غلط لأن generate_next بيقرأ counters المفروض check_level يقرأها الأول.

**الحل**: Trigger orchestrator واحد يضمن الترتيب 100%.

