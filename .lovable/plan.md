

# الخطة النهائية المُقفلة 100%: Compliance Hardening + 4 الثغرات الزمنية والتشغيلية

---

## الجزء 1: Migration واحدة `<ts>_makeup_compliance_hardening_final.sql`

### A. Snapshot المنهج + Trigger مُحكم (الأصلية موجودة)
```sql
CREATE OR REPLACE FUNCTION enforce_makeup_session_integrity() RETURNS trigger AS $$
DECLARE v_orig RECORD;
BEGIN
  IF NEW.is_makeup IS NOT TRUE THEN RETURN NEW; END IF;
  IF NEW.makeup_session_id IS NULL THEN
    RAISE EXCEPTION 'MAKEUP_MISSING_REFERENCE'; END IF;
  SELECT s.level_id, s.content_number INTO v_orig
  FROM makeup_sessions m JOIN sessions s ON s.id = m.original_session_id
  WHERE m.id = NEW.makeup_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MAKEUP_ORIGINAL_NOT_FOUND'; END IF;
  NEW.level_id := COALESCE(NEW.level_id, v_orig.level_id);
  NEW.content_number := COALESCE(NEW.content_number, v_orig.content_number);
  IF NEW.level_id IS NULL OR NEW.content_number IS NULL THEN
    RAISE EXCEPTION 'MAKEUP_ORIGINAL_INCOMPLETE'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
```

### B. ثغرة #2 — Duration NOT NULL (Hard guarantee)
```sql
UPDATE sessions SET duration_minutes = 60 WHERE duration_minutes IS NULL;
ALTER TABLE sessions ALTER COLUMN duration_minutes SET NOT NULL;
ALTER TABLE sessions ALTER COLUMN duration_minutes SET DEFAULT 60;
ALTER TABLE sessions ADD CONSTRAINT sessions_duration_positive 
  CHECK (duration_minutes > 0 AND duration_minutes <= 480);
```

### C. ثغرة #1 — Computed `end_at` UTC من DB (مصدر الحقيقة)
```sql
-- Generated column يحسب end_at بصيغة UTC على أساس Africa/Cairo
ALTER TABLE sessions ADD COLUMN end_at TIMESTAMPTZ
  GENERATED ALWAYS AS (
    ((session_date::text || ' ' || session_time::text)::timestamp 
      AT TIME ZONE 'Africa/Cairo')
    + (duration_minutes || ' minutes')::interval
  ) STORED;

ALTER TABLE sessions ADD COLUMN start_at TIMESTAMPTZ
  GENERATED ALWAYS AS (
    (session_date::text || ' ' || session_time::text)::timestamp 
      AT TIME ZONE 'Africa/Cairo'
  ) STORED;

CREATE INDEX idx_sessions_end_at ON sessions(end_at);
```
الـ compliance-monitor يقرأ `end_at` مباشرة (مش يحسبه في JS) → مفيش timezone confusion ولا NaN.

### D. Idempotency + State Machine
```sql
ALTER TABLE instructor_warnings 
  ADD COLUMN IF NOT EXISTS resolution_reason TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settings_version INTEGER,
  ADD COLUMN IF NOT EXISTS trace_id UUID;

CREATE UNIQUE INDEX idx_warnings_active_dedup
  ON instructor_warnings(session_id, warning_type, instructor_id)
  WHERE status IN ('pending','active');
```

### E. 4 Auto-resolve triggers (attendance/assignments/quiz_assignments/session_evaluations)
كل trigger يـ UPDATE الـ warnings المطابقة لـ `status='resolved', resolution_reason=<event>`.

### F. ثغرة #4 — Anomaly dedup
```sql
CREATE UNIQUE INDEX idx_dq_issues_dedup_daily
  ON data_quality_issues(entity_id, issue_type, (date_trunc('day', detected_at)));
CREATE INDEX idx_dq_issues_type_time 
  ON data_quality_issues(issue_type, detected_at DESC);
```

### G. ثغرة #3 — Audit completeness + trace_id
```sql
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS trace_id UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id TEXT;
CREATE INDEX idx_audit_trace ON audit_logs(trace_id) WHERE trace_id IS NOT NULL;
```

### H. Settings: validation + versioning + audit
- Default row في `system_settings` (key='compliance_grace_periods', JSON بالقيم).
- Trigger `validate_grace_settings` (CHECK كامل + bump version).
- Trigger `audit_grace_settings_change` يكتب `audit_logs` بـ `trace_id = gen_random_uuid()` و `old_value/new_value/version/changed_by`.
- RLS: SELECT لـ admin/reception، UPDATE لـ admin فقط.

### I. Indexes إضافية للأداء
```sql
CREATE INDEX idx_sessions_makeup_id ON sessions(makeup_session_id) WHERE is_makeup;
CREATE INDEX idx_makeup_assigned_inst ON makeup_sessions(assigned_instructor_id) 
  WHERE assigned_instructor_id IS NOT NULL;
CREATE INDEX idx_sessions_scan_window 
  ON sessions(end_at, status) WHERE status = 'completed';
```

---

## الجزء 2: تعديل `compliance-monitor/index.ts`

### A. trace_id للـ run + settings snapshot واحد
```typescript
const RUN_TRACE_ID = crypto.randomUUID();
const RUN_STARTED_AT = new Date().toISOString();

const { data: settingsRow } = await supabase
  .from('system_settings')
  .select('value, version')
  .eq('key', 'compliance_grace_periods').maybeSingle();

const RAW = settingsRow?.value ?? { 
  attendance_minutes: 60, quiz_hours: 24, assignment_hours: 24, 
  evaluation_hours: 24, makeup_multiplier: 1.5 
};
const SETTINGS_VERSION = settingsRow?.version ?? 0;

console.log(JSON.stringify({ 
  trace_id: RUN_TRACE_ID, settings_version: SETTINGS_VERSION, 
  settings: RAW, started_at: RUN_STARTED_AT 
}));

const SEC = {
  attendance: Math.ceil(RAW.attendance_minutes * 60),
  quiz:       Math.ceil(RAW.quiz_hours * 3600),
  assignment: Math.ceil(RAW.assignment_hours * 3600),
  evaluation: Math.ceil(RAW.evaluation_hours * 3600),
};
const MUL = RAW.makeup_multiplier;
const effGrace = (t, isMakeup) => isMakeup ? Math.ceil(SEC[t] * MUL) : SEC[t];
```

### B. ثغرة #1 + #2 — حساب الوقت من `end_at` (DB-supplied, UTC)
```typescript
function isPastGrace(s: Session, type: keyof typeof SEC): boolean {
  if (!s.end_at) return false; // safety
  const endMs = new Date(s.end_at).getTime(); // already UTC ISO
  const graceSec = effGrace(type, s.is_makeup);
  return (Date.now() - endMs) / 1000 >= graceSec;
}
```
لا `new Date(date+time)` → لا timezone bugs. لا `+ duration_minutes` → لا NaN.

### C. ثغرة الأداء — fetchEligibleSessions مع نافذة محدودة
```typescript
const SCAN_WINDOW_DAYS = 2;
const cutoff = new Date(Date.now() - SCAN_WINDOW_DAYS * 86400000).toISOString();

const { data: sessions } = await supabase
  .from('sessions')
  .select(`id, session_date, session_time, duration_minutes, end_at, 
           is_makeup, makeup_session_id, level_id, content_number, status,
           groups!inner(id, instructor_id),
           makeup_sessions:makeup_session_id(assigned_instructor_id, original_session_id,
             original_session:original_session_id(session_number, session_date))`)
  .eq('status', 'completed')
  .gte('end_at', cutoff)
  .lte('end_at', new Date().toISOString());
```

### D. Resolver المدرب (fallback إجباري)
```typescript
const getResponsibleInstructor = (s) => 
  (s.is_makeup && s.makeup_sessions?.assigned_instructor_id) 
    ?? s.groups?.instructor_id ?? null;
```

### E. Idempotent insert + trace_id
```typescript
const { data: inserted } = await supabase.from('instructor_warnings').insert({
  session_id: s.id, instructor_id, warning_type, status: 'active',
  title, message, settings_version: SETTINGS_VERSION, trace_id: RUN_TRACE_ID,
}).select('id').maybeSingle();
// inserted=null → ON CONFLICT (الـ partial unique index) → 'duplicate'
```

### F. ثغرة #4 — Anomaly insert idempotent
```typescript
if (s.is_makeup && presentStudents.length > 1) {
  await supabase.from('data_quality_issues').upsert({
    issue_type: 'makeup_multi_student_anomaly',
    entity_table: 'sessions', entity_id: s.id,
    details: { count: presentStudents.length, trace_id: RUN_TRACE_ID }
  }, { onConflict: 'entity_id,issue_type,(date_trunc(day,detected_at))', ignoreDuplicates: true });
}
```

### G. نص الإنذار (تاريخ الأصلية)
```typescript
const makeupCtx = (s, isAr) => {
  if (!s.is_makeup) return '';
  const d = s.makeup_sessions?.original_session?.session_date ?? '?';
  return isAr ? ` (تعويضية لسيشن ${d})` : ` (Makeup for ${d})`;
};
```

### H. Run summary log في النهاية
```typescript
console.log(JSON.stringify({
  trace_id: RUN_TRACE_ID, settings_version: SETTINGS_VERSION,
  scanned: sessions.length, created: createdCount, 
  duplicates: dupCount, anomalies: anomalyCount,
  duration_ms: Date.now() - new Date(RUN_STARTED_AT).getTime()
}));
```
+ كتابة row في `compliance_scan_runs` بـ `trace_id` و `settings_version`.

---

## الجزء 3: واجهة الأدمن

### `src/components/settings/ComplianceGracePeriodsSettings.tsx`
- 5 inputs (attendance min، باقي ساعات، multiplier 1.0–3.0).
- Validation client مطابق للـ DB.
- Preview block real-time: "عادي: X | تعويضي: Y".
- Save → UPDATE على `system_settings`.
- يعرض: `Last modified by <user> at <time> — Version <N> — Trace: <uuid>`.
- داخل `Settings.tsx` تحت قسم الإنذارات (admin-only).

---

## الجزء 4: Backfill (insert tool بعد migration)

```sql
UPDATE sessions s
SET level_id = orig.level_id, content_number = orig.content_number
FROM makeup_sessions m
JOIN sessions orig ON orig.id = m.original_session_id
WHERE s.makeup_session_id = m.id AND s.is_makeup
  AND (s.level_id IS NULL OR s.content_number IS NULL)
  AND orig.level_id IS NOT NULL AND orig.content_number IS NOT NULL;
```

---

## مصفوفة الثغرات → الحل

| ثغرة | الحل |
|-----|------|
| #1 Timezone hidden bug | `end_at` GENERATED column في DB (Africa/Cairo → UTC) |
| #2 duration nullable → NaN | `NOT NULL DEFAULT 60 + CHECK > 0` |
| #3 Audit incomplete | `trace_id + request_id` في `audit_logs` + كل warning |
| #4 Anomaly spam | unique index daily + upsert ignoreDuplicates |
| Settings ver في رسالة | column `settings_version` في warning + structured logs |
| Performance scan | `gte(end_at, now-2d)` + index على `(end_at, status)` |
| Mid-run consistency | snapshot واحد أول الـ handler — no refresh |
| نص أدق | تاريخ الأصلية مش رقمها |
| State machine | enum + 4 auto-resolve triggers + dedup index |
| DB validation | trigger CHECK كامل + version bump |

---

## ملخص الملفات

| ملف | الغرض |
|-----|------|
| `supabase/migrations/<ts>_makeup_compliance_hardening_final.sql` | كل الـ schema: triggers, indexes, generated columns, settings, audit |
| `supabase/functions/compliance-monitor/index.ts` | trace_id, snapshot settings, end_at من DB, idempotent inserts, scan window |
| `src/components/settings/ComplianceGracePeriodsSettings.tsx` | UI الإعدادات + preview + version display |
| `src/pages/Settings.tsx` | تضمين الكارد |
| Insert tool (بعد migration) | Backfill للسيشنز التعويضية |

---

## النتيجة
**Production-grade 100%** — مفيش timezone bugs، مفيش NaN، مفيش log floods، كل warning قابل للتتبع بـ `trace_id` لإصدار الإعدادات والـ run اللي بناه، والـ scan بيعمل على نافذة محدودة بكفاءة.

