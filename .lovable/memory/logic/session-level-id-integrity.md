---
name: session-level-id-integrity
description: تأمين عمود sessions.level_id كحقل إجباري لأي سيشن نشطة، مع backfill وtrigger يمنع NULL
type: feature
---

# Session level_id Integrity Guard

## المشكلة الأصلية
السيشنات القديمة كانت تُسجَّل أحياناً بدون `level_id`. ده كان يكسر:
- `schedule_final_exam_for_students` (الطلاب يظهروا غير مؤهلين)
- دوال الترقية والحضور التي تفلتر بـ `s.level_id = current_level_id`
- تقارير الجلسات حسب المستوى

## الحل (Trigger: `ensure_session_level_id_trg`)
- يعمل `BEFORE INSERT OR UPDATE OF level_id, status, group_id ON sessions`
- لو `NEW.level_id IS NULL` → يأخذ `groups.level_id` تلقائياً
- لو المجموعة كذلك بلا `level_id` → يرفع exception (إلا لو الحالة `cancelled`)

## القاعدة
- **مستحيل** يتم حفظ سيشن نشطة (`scheduled`/`in_progress`/`completed`) بـ `level_id = NULL`
- السيشنات الملغاة (`cancelled`) فقط مسموح لها تكون بدون مستوى

## ما تم backfill
كل السيشنات المكتملة بدون `level_id` تم تحديثها لتأخذ `group.level_id`.
