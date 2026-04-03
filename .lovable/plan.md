

## خطة إصلاح نظام البدء من منتصف المستوى (Mid-Level Start) — النسخة النهائية

### المشكلة
`start-group` ينشئ سيشنات وهمية (1 إلى N-1) و`populate-completed-sessions` يملأها ببيانات مزيفة (حضور 100%، درجات 100%). هذا يكسر كل الـ metrics.

---

### المرحلة 1: تعديل `start-group/index.ts`

- الـ loop يبدأ من `startingNum` مباشرة — سيشن واحدة فقط بحالة `scheduled`
- حذف استدعاء `populate-completed-sessions` بالكامل
- حذف استدعاء `assign_subscription_dates_bulk` (أو إبقاؤه لو مطلوب للاشتراكات)
- تحديث `last_delivered_content_number = startingNum - 1`
- `owed_sessions_count = 0`

### المرحلة 2: حذف `populate-completed-sessions`

- حذف محتوى `supabase/functions/populate-completed-sessions/index.ts` بالكامل واستبداله بـ return success فقط (أو حذف الملف)

### المرحلة 3: تنظيف البيانات — Migration

**تحديد السيشنات الوهمية**: لكل مجموعة `starting_session_number > 1`:
```
WHERE group_id = X AND content_number < starting_session_number AND status = 'completed'
```
الاعتماد على `content_number` فقط كمعيار — أدق من الاعتماد على `status`.

**ترتيب الحذف** (لتجنب FK constraint errors):
1. `session_evaluations` WHERE session_id IN (backfilled sessions)
2. `assignment_submissions` WHERE assignment_id IN (backfilled assignments)
3. `assignments` WHERE session_id IN (backfilled sessions)
4. `quiz_submissions` WHERE quiz_assignment_id IN (backfilled quiz_assignments)
5. `quiz_assignments` WHERE session_id IN (backfilled sessions)
6. `quizzes` WHERE session_id IN (backfilled sessions)
7. `attendance` WHERE session_id IN (backfilled sessions)
8. `sessions` (السيشنات الوهمية نفسها)

**تصحيح groups**: `last_delivered_content_number = starting_session_number - 1`

### مراجعة إضافية: scheduling logic

- التأكد إن `auto_generate_next_session` trigger يعتمد على `content_number` مش `COUNT(sessions)` — لأن بعد حذف السيشنات 1-5 أي logic بيعتمد على العدد هيبوظ
- مراجعة `session_number` assignment في الـ trigger

### الملفات المتأثرة

| ملف | تعديل |
|---|---|
| `supabase/functions/start-group/index.ts` | Loop من startingNum فقط، حذف populate call |
| `supabase/functions/populate-completed-sessions/index.ts` | حذف/تفريغ |
| Migration جديد | حذف بيانات وهمية + تصحيح groups |
| مراجعة trigger `auto_generate_next_session` | التأكد من اعتماده على content_number |

