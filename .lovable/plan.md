

# خطة تنفيذ نظام التجميد الكامل (Frozen Groups Enforcement)

## الوضع الحالي
- `status = 'frozen'` مجرد label في UI
- كل الـ backend (triggers + edge functions) يتجاهله
- UI فيها frozen alerts جاهزة في `StudentDashboard`, `GroupDetails`, `Sessions`

## التغييرات المطلوبة

### 1. Migration: تعديل `auto_generate_next_session` trigger
**ملف**: Migration جديدة

إضافة check بعد سطر `IF NOT v_group.is_active` مباشرة:
```sql
-- Add frozen check to auto_generate_next_session
SELECT g.status INTO v_group_status FROM groups g WHERE g.id = NEW.group_id;
IF v_group_status = 'frozen' THEN RETURN NEW; END IF;
```

### 2. Migration: trigger لإلغاء السيشنات عند التجميد وإعادة التوليد عند الإلغاء
**ملف**: نفس الـ Migration

```sql
CREATE FUNCTION handle_group_freeze_unfreeze() ...
```
- عند `frozen`: كل sessions بـ `status = 'scheduled'` → `cancelled` مع `cancellation_reason = 'group_frozen'`
- عند `active` (من frozen): توليد السيشن التالية بناءً على آخر session مكتملة
- إضافة `'group_frozen'` كـ cancellation_reason مسموح (لو فيه constraint)

### 3. Edge Functions: إضافة frozen filter

**`auto-complete-sessions/index.ts`** (سطر 38-42)
- بعد fetch السيشنات، join مع groups وفلتر frozen:
```typescript
.select("id, session_date, session_time, duration_minutes, group_id, groups!inner(status)")
// ثم في الـ loop: if session.groups.status === 'frozen') continue;
```

**`session-reminders/index.ts`** (سطر ~85-100)
- إضافة filter: `.neq('groups.status', 'frozen')` في الـ queries الموجودة (inner join موجود أصلاً)

**`compliance-monitor/index.ts`** (الأقسام 1-4)
- إضافة join مع groups في كل section وفلتر `groups.status != 'frozen'`
- أو: بناء set من frozen group_ids مرة واحدة في البداية وskip أي session تنتمي لهم

**`generate-sessions/index.ts`** (سطر 57-61)
- إضافة `.neq('status', 'frozen')` بجانب `.eq('is_active', true)`

### 4. Frontend: تحسين تجربة الطالب في الجروب المجمد

**`StudentDashboard.tsx`** — الـ alert الموجود ممتاز (سطر 312-333). تعديلات إضافية:
- تحديث نص التنبيه ليشمل "السيشنات متوقفة مؤقتاً"
- إخفاء قسم "upcoming sessions" لو الجروب frozen
- إخفاء أزرار "Take Quiz" و "Submit Assignment" الجديدة (القديمة تفضل view-only)

**`MyQuizzes.tsx`** + **`TakeQuiz.tsx`**:
- إضافة check: لو الطالب في جروب frozen → عرض رسالة بدل زر Start Quiz
- القديمة (submitted/graded) تفضل visible

**`Assignments.tsx`** + **`SubmitAssignment.tsx`**:
- نفس المنطق: منع submit جديد لو الجروب frozen
- عرض القديم read-only

**`MySessions.tsx`**:
- عرض السيشنات المكتملة عادي
- إضافة empty state واضح: "مفيش سيشنات حالياً — الجروب متجمد"

### 5. لا تعديل على `check-payment-dues`
- الدفع مستمر أثناء التجميد (by design)
- الطالب لسه مطلوب منه يدفع

---

## السلوك بعد التنفيذ

```
Admin يجمد الجروب:
  → trigger يلغي كل السيشنات المجدولة (reason: group_frozen)
  → auto_generate يتوقف (frozen check)
  → auto-complete يتخطى سيشنات الجروب
  → compliance-monitor يتجاهل الجروب
  → session-reminders يتخطى الجروب
  → الدفع يستمر عادي

الطالب يفتح الاكونت:
  → يدخل عادي (مفيش block)
  → يشوف alert واضح "جروبك متجمد"
  → يشوف السيشنات القديمة
  → مفيش upcoming sessions
  → مفيش quiz/assignment جديد
  → يقدر يشوف القديم بس

Admin يعيد التفعيل:
  → trigger يولد السيشن التالية
  → كل شيء يرجع عادي
```

## الملفات المتأثرة

| ملف | تعديل |
|-----|-------|
| Migration جديدة | frozen check في trigger + freeze/unfreeze handler |
| `auto-complete-sessions/index.ts` | skip frozen groups |
| `session-reminders/index.ts` | filter frozen groups |
| `compliance-monitor/index.ts` | filter frozen groups |
| `generate-sessions/index.ts` | filter frozen groups |
| `StudentDashboard.tsx` | تحسين alert + إخفاء actions |
| `MyQuizzes.tsx` | منع quiz submission لجروب frozen |
| `TakeQuiz.tsx` | block start لو frozen |
| `Assignments.tsx` | منع submit جديد |
| `SubmitAssignment.tsx` | block submit لو frozen |
| `MySessions.tsx` | empty state واضح |

