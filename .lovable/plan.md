

# تنفيذ نظام نقل الطالب الذكي - v3 النهائية (مع الملاحظات الأربعة)

## ملخص

إنشاء RPC `transfer_student_to_group` وتعديل الفرونت لاستخدامه عند إضافة طلاب لمجموعات بدأت بالفعل.

## اكتشاف مهم من البيانات الفعلية

`session_number` في جدول `sessions` هو **ترقيم تسلسلي داخل الجروب** (1, 2, 3...) وليس ترقيم عالمي داخل الليفل. المجموعة اللي `starting_session_number = 9` عندها sessions مرقمة 1-9 مش 9-17.

**الحل:** استخدام `canonical_session = session_number + starting_session_number - 1` كمعيار مقارنة موحد عبر الجروبات.

## الملاحظات الأربعة وكيف اتقفلت

| # | الملاحظة | الحل |
|---|----------|------|
| 1 | Track filter معقد | تبسيط: جلب `v_old_track_id` من progress، وفلترة مباشرة على `groups.level_id` + `group_student_progress.current_track_id = v_old_track_id` |
| 2 | session_number مش موحد عبر الجروبات | استخدام `session_number + starting_session_number - 1` كـ canonical position |
| 3 | `no_progress_created` يرجع بدري قبل النقل | أصبح مجرد flag ضمن النتيجة بعد تنفيذ النقل الكامل |
| 4 | guard على `p_from_group_id IS NULL` | إضافة `IF p_from_group_id IS NOT NULL THEN ... END IF` صريح |

## التغييرات المطلوبة

### 1. Migration SQL: إنشاء `transfer_student_to_group` RPC

**ملاحظة:** الـ unique constraints الثلاثة موجودة بالفعل:
- `group_students(group_id, student_id)` -- موجود
- `group_student_progress(group_id, student_id)` -- موجود
- `makeup_sessions(student_id, original_session_id, makeup_type)` -- موجود

المنطق بالترتيب:

```text
Step 0: Validations
  - Permission: admin or reception via has_role(auth.uid(), ...)
  - Advisory lock: pg_advisory_xact_lock(hashtext(p_student_id::text))
  - Same-group: p_from_group_id = p_to_group_id -> return 'no_op'

Step 1: Target group info
  - SELECT level_id, age_group_id, has_started, starting_session_number
  - Error if not found

Step 2: Source progress (optional)
  - FROM group_student_progress WHERE student_id + group_id = p_from_group_id
  - Extract: current_level_id, current_track_id, level_started_at
  - If no from_group: try any active progress for student
  - v_no_progress := false initially

Step 3: Level check
  - If progress found AND current_level_id != target level_id -> return 'level_mismatch' (no changes)
  - If no progress found: v_no_progress := true, skip level check, will create fresh

Step 4: Canonical session gap (completed only)
  - group_canonical_last:
    MAX(s.session_number + g.starting_session_number - 1)
    FROM sessions s JOIN groups g ON g.id = s.group_id
    WHERE s.group_id = p_to_group_id AND s.status = 'completed'

  - student_canonical_last:
    MAX(s.session_number + g.starting_session_number - 1)
    FROM attendance a
    JOIN sessions s ON s.id = a.session_id
    JOIN groups g ON g.id = s.group_id
    WHERE a.student_id = p_student_id
      AND a.status IN ('present','late')
      AND s.level_id = v_target_level_id
      AND s.status = 'completed'
      AND (v_old_track_id IS NULL OR gsp.current_track_id = v_old_track_id)
    -- Simple track filter: join group_student_progress directly

  - gap = COALESCE(group_canonical_last, 0) - COALESCE(student_canonical_last, 0)

Step 5: p_force decision
  - gap > 0: student_behind -> proceed + create makeups
  - gap < 0: student_ahead
    - p_force = false: return warning WITHOUT changes
    - p_force = true: proceed WITHOUT makeups
  - gap = 0: equal -> proceed

Step 6: Atomic transfer (always runs for behind/equal/forced-ahead)
  6a: IF p_from_group_id IS NOT NULL THEN
        UPDATE group_students SET is_active = false
        WHERE student_id AND group_id AND is_active = true;
      END IF;

  6b: INSERT INTO group_students (student_id, group_id, is_active, joined_at)
      VALUES (..., true, now())
      ON CONFLICT (student_id, group_id) DO UPDATE SET is_active = true;
      -- joined_at NOT updated on conflict (preserves original)

  6c: INSERT INTO group_student_progress (...)
      ON CONFLICT (student_id, group_id) DO UPDATE SET
        current_level_id, status='in_progress', current_track_id, level_started_at, updated_at;

  6d: IF has_started THEN
        PERFORM assign_subscription_dates(p_to_group_id, p_student_id);
      END IF;

Step 7: Makeup sessions (student_behind only)
  - For each session in target group WHERE canonical > student_canonical_last
  - Check NOT EXISTS attendance for same canonical position in any group for same level
  - INSERT INTO makeup_sessions ... ON CONFLICT (student_id, original_session_id, makeup_type) DO NOTHING
  - Collect missed canonical numbers via array_agg ORDER BY

Step 8: Return
  {
    status: 'student_behind'|'student_ahead'|'equal'|'no_progress_created'|'level_mismatch'|'no_op',
    student_canonical_last,
    group_canonical_last,
    gap,
    makeup_sessions_created,
    missed_session_numbers (sorted int array),
    progress_transferred: true
  }
  -- no_progress_created is set when v_no_progress AND transfer completed
```

### 2. Frontend: `src/pages/Groups.tsx`

**Changes to `handleSaveStudents` (lines 324-388):**

For each student in `toAdd`:
- If `selectedGroup.has_started`: call RPC `transfer_student_to_group` with `p_force = false`
  - `student_ahead`: store warning in new state, show AlertDialog
  - `student_behind`: show toast with makeup count + session numbers
  - `level_mismatch`: show error toast, skip student
  - `equal` / `no_progress_created`: silent success
- If `!has_started`: keep current behavior (simple insert/update)

For `toRemove`: keep current behavior (deactivate only)

**New state:**
```text
transferWarning: {
  studentId: string,
  studentName: string,
  gap: number,
  studentLast: number,
  groupLast: number,
  groupId: string,
  fromGroupId: string | null
} | null
```

**New AlertDialog:**
- Title: "الطالب سابق المجموعة" / "Student is ahead of group"
- Body: gap details
- "متابعة" -> re-call RPC with `p_force = true`, then continue saving
- "إلغاء" -> skip this student

**New imports:** `AlertDialog` components (already imported pattern exists in codebase)

### Files Changed

| File | Change |
|------|--------|
| New migration SQL | `transfer_student_to_group` RPC function |
| `src/pages/Groups.tsx` | Update `handleSaveStudents`, add transfer warning AlertDialog + state |

