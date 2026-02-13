

# تغيير نظام توليد السيشنات: من "دفعة واحدة" إلى "واحدة تلو الأخرى"

## الوضع الحالي

عند بدء مجموعة (Start Group)، يتم توليد الـ 12 سيشن كلهم مرة واحدة. وفيه أيضاً edge function `generate-sessions` لتوليد سيشنات مستقبلية.

## الفكرة الجديدة

بدل توليد كل السيشنات دفعة واحدة، يتم توليد سيشن واحدة فقط في البداية. ولما تكتمل، يتولد السيشن التالي تلقائياً.

---

## التغييرات المطلوبة

### 1. تعديل `supabase/functions/start-group/index.ts`

بدل إنشاء 12 سيشن، يتم إنشاء سيشن واحدة فقط (أو عدد السيشنات السابقة لـ `starting_session_number` + السيشن الحالية):
- لو `starting_session_number = 1`: يتم إنشاء سيشن 1 فقط بحالة `scheduled`
- لو `starting_session_number = 5`: يتم إنشاء سيشنات 1-4 بحالة `completed` + سيشن 5 بحالة `scheduled`

### 2. تعديل trigger `create_group_sessions` (database function)

نفس التعديل: بدل توليد 12 سيشن، يتم توليد فقط السيشنات حتى `starting_session_number`.

### 3. إنشاء database function + trigger للتوليد التلقائي

**Database function جديدة `auto_generate_next_session`:**
- تعمل كـ trigger على جدول `sessions` عند `UPDATE`
- لما سيشن تتحول لـ `completed`:
  1. تتحقق إن `session_number` أقل من 12
  2. تتحقق إن مفيش سيشن بالرقم التالي أصلاً
  3. تتحقق إن المجموعة لسه `is_active`
  4. تحسب تاريخ السيشن الجديدة (تاريخ السيشن الحالية + 7 أيام)
  5. تنشئ السيشن الجديدة بحالة `scheduled`

```text
CREATE FUNCTION auto_generate_next_session()
  RETURNS trigger AS $$
  BEGIN
    -- Only trigger when status changes to 'completed'
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
      -- Check session_number < 12
      -- Check no next session exists
      -- Check group is active
      -- INSERT next session (date = current + 7 days)
    END IF;
    RETURN NEW;
  END;

CREATE TRIGGER on_session_completed
  AFTER UPDATE ON sessions
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION auto_generate_next_session();
```

### 4. معالجة المجموعات الموجودة حالياً

المجموعات اللي عندها 12 سيشن بالفعل مش هتتأثر - السيشنات موجودة والـ trigger مش هيعمل حاجة لأن السيشن التالية موجودة أصلاً (الشرط رقم 2 هيمنع التكرار).

المجموعات اللي عندها سيشنات `scheduled` مستقبلية: ممكن نسيبها زي ما هي أو نحذف السيشنات المستقبلية غير المكتملة ونخلي الـ trigger يولدها واحدة واحدة. الأسلم نسيبها.

### 5. تعديل `supabase/functions/generate-sessions/index.ts`

ممكن نحوله لتوليد سيشن واحدة قادمة فقط بدل 4 أسابيع، أو نحذفه بالكامل لأن الـ trigger هيحل محله. الأفضل نخليه كـ fallback يدوي للأدمن في حالة الطوارئ مع تعديله ليولد السيشن التالية فقط للمجموعات اللي مفيش عندها سيشن `scheduled`.

### 6. تعديل `src/pages/SessionDetails.tsx`

لما السيشن تتحول لـ `completed` (سواء تلقائي أو يدوي)، الـ trigger في قاعدة البيانات هيتعامل مع التوليد. مفيش تعديل مطلوب في الكود لأن المنطق في الـ database trigger.

### 7. حذف أو تعديل زر "Generate Sessions" في `src/pages/Sessions.tsx`

ممكن نخليه يستدعي `generate-sessions` المعدل كأداة طوارئ، أو نشيله بالكامل.

---

## التفاصيل التقنية

### Database Migration

```text
-- 1. Create the auto-generate function
CREATE FUNCTION auto_generate_next_session() RETURNS trigger ...

-- 2. Create the trigger
CREATE TRIGGER on_session_completed AFTER UPDATE ON sessions ...
```

### تعديل start-group edge function

```text
-- Before: creates 12 sessions
-- After: creates sessions 1..starting_session_number only
-- Session at starting_session_number = 'scheduled'
-- Sessions before = 'completed'
```

### تعديل database function create_group_sessions

```text
-- Before: FOR i IN 1..12 LOOP
-- After: FOR i IN 1..starting_num LOOP
-- Same logic for completed vs scheduled status
```

---

## الملفات المتأثرة

1. **Migration جديد** - إنشاء function + trigger `auto_generate_next_session`
2. **Migration** - تعديل `create_group_sessions` DB function
3. **`supabase/functions/start-group/index.ts`** - تقليل السيشنات المولدة
4. **`supabase/functions/generate-sessions/index.ts`** - تعديل ليولد سيشن واحدة قادمة فقط
5. **`src/pages/Sessions.tsx`** - تحديث النص/السلوك لزر التوليد (اختياري)

## المميزات

- مرونة أكبر: لو المجموعة اتجمدت مش هيكون فيه سيشنات مستقبلية فاضية
- تحكم أدق: كل سيشن بتتولد بناءً على إكتمال اللي قبلها فعلاً
- بساطة: الـ trigger في قاعدة البيانات يضمن التوليد بغض النظر عن مصدر التحديث

