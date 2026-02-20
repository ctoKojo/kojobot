# اصلاح نظام الحضور والسيشنات التعويضية - Production Hardened

---

## المشكلة المؤكدة من البيانات

سجل حضور (`f46505f3`) لطالب غائب عنده:

- `compensation_status = NULL` (المفروض `pending_compensation`)
- `makeup_session_id = NULL` (رغم وجود تعويضية `b8d9a0bb` في `makeup_sessions`)

السبب: الفرونت بيحفظ الحضور في loop منفصل، وبعدها بيستدعي `create_group_makeup_sessions` منفصل، ومش بيربط النتيجة.

---

## الجزء 1: Database Migration

### ا. Backfill البيانات التاريخية + NOT NULL

```text
-- 1. ربط التعويضيات اليتيمة بسجلات الحضور
UPDATE attendance a
SET makeup_session_id = m.id
FROM makeup_sessions m
WHERE a.student_id = m.student_id
  AND a.session_id = m.original_session_id
  AND a.status = 'absent'
  AND a.makeup_session_id IS NULL;

-- 2. ضبط compensation_status للغياب
UPDATE attendance
SET compensation_status = CASE
  WHEN makeup_session_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM makeup_sessions ms
    WHERE ms.id = makeup_session_id AND ms.status = 'completed'
  ) THEN 'compensated'
  WHEN status = 'absent' THEN 'pending_compensation'
  ELSE 'none'
END
WHERE compensation_status IS NULL;

-- 3. تحويل لـ NOT NULL مع default
ALTER TABLE public.attendance
ALTER COLUMN compensation_status SET DEFAULT 'none';

ALTER TABLE public.attendance
ALTER COLUMN compensation_status SET NOT NULL;
```

### ب. تعديل `create_makeup_session` (get_or_create)

بدل الاعتماد على `EXCEPTION WHEN unique_violation`:

```text
-- قبل INSERT، نتحقق لو موجودة
SELECT id INTO v_new_id
FROM makeup_sessions
WHERE student_id = p_student_id
  AND original_session_id = p_original_session_id
  AND makeup_type = p_makeup_type;

IF v_new_id IS NOT NULL THEN
  RETURN jsonb_build_object('created', false, 'reason', 'already_exists', 'id', v_new_id);
END IF;

-- لو مش موجودة، INSERT عادي
INSERT INTO makeup_sessions (...) VALUES (...) RETURNING id INTO v_new_id;
```

- ترجع `id` دايما (سواء created او already_exists)
- بدون exception control flow

### ج. RPC: `save_attendance` (الحل الموحد)

```text
CREATE OR REPLACE FUNCTION public.save_attendance(
  p_session_id UUID,
  p_group_id UUID,
  p_records JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
```

المنطق التفصيلي:

1. **Authorization**: admin / reception / instructor (للمجموعة)
  - لو مش authorized: `RAISE EXCEPTION` (مش return json - عشان يعمل rollback كامل)
2. **Lock + Validation**:
  ```text
   SELECT id INTO v_session_id
   FROM sessions
   WHERE id = p_session_id AND group_id = p_group_id
   FOR UPDATE;

   IF v_session_id IS NULL THEN
     RAISE EXCEPTION 'Invalid session or group';
   END IF;
  ```
3. **Loop على كل record**:
  **لو `status = 'absent'**`:
  - استدعاء `create_makeup_session` (اللي بقت get_or_create) - ترجع `id` دايما
  - لو `id = NULL`: `RAISE EXCEPTION` (validation failure)
  - Upsert attendance مع `makeup_session_id = v_makeup_id` و `compensation_status = 'pending_compensation'`
   **لو `status != 'absent'**` (present / late / excused):
  - **اولا**: نشوف لو فيه `makeup_session_id` قديم مربوط
  - **لو موجود وحالته `pending**`: نلغيه
  - Upsert attendance مع `makeup_session_id = NULL` و `compensation_status = 'none'`
4. **Auto-confirm instructor**: لو المستدعي هو instructor المجموعة
  - تحقق من عدم وجود سجل حضور مسبق
  - Insert في `session_staff_attendance` مع `actual_hours = duration_minutes / 60`
5. **Auto-complete session**: لو كل الطلاب عندهم attendance + المدرب confirmed + الوقت عدى
  - تحويل session status لـ `completed`
6. **Return**:
  ```text
   jsonb_build_object(
     'saved', v_total,
     'makeups_created', v_created_count,
     'makeups_skipped', v_skipped_count,
     'makeups_cancelled', v_cancelled_count,
     'instructor_confirmed', v_instructor_confirmed
   )
  ```

---

## الجزء 2: تحسين الفرونت (`src/pages/Attendance.tsx`)

### ا. استبدال `saveAttendance` بالكامل

بدل: loop + `autoCreateMakeupSessions` + `autoConfirmInstructorAttendance`

يبقى:

```text
const records = attendanceRecords.map(r => ({
  student_id: r.student_id,
  status: r.status,
  notes: r.notes || null,
}));

const { data, error } = await supabase.rpc('save_attendance', {
  p_session_id: selectedSession,
  p_group_id: selectedGroup,
  p_records: records,
});
```

- **بعد النجاح**: `fetchAttendance()` لجلب البيانات الحقيقية من الداتابيز (مش الاعتماد على local state)
- **رسالة تفصيلية**: "تم حفظ 8 سجلات + انشاء 2 تعويضية + الغاء 1 تعويضية"

### ب. تحسين `AttendanceRecord` interface

```text
interface AttendanceRecord {
  id?: string;
  session_id: string;
  student_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
  compensation_status?: string;     // جديد
  makeup_session_id?: string | null; // جديد
}
```

### ج. تحسين `fetchAttendance`

جلب `compensation_status` و `makeup_session_id` مع السجلات وعرضهم في الجدول.

### د. زر "تحضير الكل"

- يغير local state فقط (مش حفظ فوري)
- **تحذير**: لو فيه طالب `compensation_status = 'compensated'`، يعرض warning قبل تغيير حالته

### هـ. مؤشرات التعويضية في الجدول

- لكل طالب غائب معاه `makeup_session_id`: badge "تعويضية منشأة"
- لو `compensation_status = 'compensated'`: badge "تم التعويض"
- لو `compensation_status = 'pending_compensation'`: badge "في انتظار التعويض"

### و. حذف الدوال القديمة

حذف `autoCreateMakeupSessions` و `autoConfirmInstructorAttendance` من الفرونت بالكامل (كل المنطق انتقل للـ RPC).

### ز. Validation قبل الحفظ

- منع الحفظ لو مفيش طلاب في المجموعة
- تحذير (مش منع) لو السيشن `completed`

---

## الملفات المتأثرة


| الملف                      | نوع التعديل                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------- |
| Migration SQL              | backfill + NOT NULL + تعديل `create_makeup_session` + RPC `save_attendance`        |
| `src/pages/Attendance.tsx` | استبدال save logic بـ RPC واحد + زر تحضير الكل + مؤشرات التعويضية + حذف دوال قديمة |


---

## النتيجة بعد التنفيذ

- مفيش `compensation_status = NULL` ابدا (NOT NULL constraint)
- مفيش attendance بدون ربط بالتعويضية (الـ RPC يربط فورا)
- مفيش orphan makeup sessions (الغاء تلقائي عند تعديل الغياب لحضور)
- مفيش duplicate makeups (get_or_create بدون exception flow)
- مفيش race condition (FOR UPDATE lock على session)
- مفيش partial save (كل شيء في transaction واحدة)
- الـ UI دايما يعكس server state (refetch بعد كل حفظ)