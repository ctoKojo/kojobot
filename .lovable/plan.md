

# خطة إنشاء 12 سيشن تلقائياً مع مرونة التعديل

## الهدف

عند إنشاء أي جروب جديد، يتم إنشاء **كل الـ 12 سيشن** تلقائياً، مع إمكانية إعادة جدولة السيشنات المستقبلية عند تغيير الجدول.

---

## المرحلة الأولى: Database Functions و Triggers

### 1. Function لإنشاء 12 سيشن عند إضافة جروب

```sql
CREATE OR REPLACE FUNCTION create_group_sessions()
RETURNS TRIGGER AS $$
DECLARE
  day_map jsonb := '{"Sunday":0,"Monday":1,"Tuesday":2,"Wednesday":3,"Thursday":4,"Friday":5,"Saturday":6}';
  target_day integer;
  start_date date;
  i integer;
BEGIN
  IF NOT NEW.is_active THEN
    RETURN NEW;
  END IF;
  
  target_day := (day_map ->> NEW.schedule_day)::integer;
  
  start_date := CURRENT_DATE;
  WHILE EXTRACT(DOW FROM start_date) != target_day LOOP
    start_date := start_date + 1;
  END LOOP;
  
  FOR i IN 1..12 LOOP
    INSERT INTO sessions (group_id, session_date, session_time, duration_minutes, status, session_number)
    VALUES (NEW.id, start_date + ((i-1) * 7), NEW.schedule_time, NEW.duration_minutes, 'scheduled', i);
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2. Trigger بعد إضافة جروب جديد

```sql
CREATE TRIGGER trigger_create_group_sessions
AFTER INSERT ON groups
FOR EACH ROW
EXECUTE FUNCTION create_group_sessions();
```

### 3. Function لتحديث السيشنات المستقبلية عند تغيير الجدول

```sql
CREATE OR REPLACE FUNCTION update_future_sessions()
RETURNS TRIGGER AS $$
DECLARE
  day_map jsonb := '{"Sunday":0,"Monday":1,"Tuesday":2,"Wednesday":3,"Thursday":4,"Friday":5,"Saturday":6}';
  target_day integer;
  start_date date;
  session_record RECORD;
  new_date date;
BEGIN
  IF OLD.schedule_day = NEW.schedule_day 
     AND OLD.schedule_time = NEW.schedule_time 
     AND OLD.duration_minutes = NEW.duration_minutes THEN
    RETURN NEW;
  END IF;
  
  target_day := (day_map ->> NEW.schedule_day)::integer;
  start_date := CURRENT_DATE;
  WHILE EXTRACT(DOW FROM start_date) != target_day LOOP
    start_date := start_date + 1;
  END LOOP;
  
  -- تحديث السيشنات المستقبلية فقط (scheduled)
  FOR session_record IN 
    SELECT id, session_number FROM sessions 
    WHERE group_id = NEW.id 
      AND status = 'scheduled'
      AND session_date >= CURRENT_DATE
    ORDER BY session_number
  LOOP
    new_date := start_date + ((session_record.session_number - 1) * 7);
    UPDATE sessions 
    SET session_date = new_date,
        session_time = NEW.schedule_time,
        duration_minutes = NEW.duration_minutes,
        updated_at = now()
    WHERE id = session_record.id;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 4. Trigger عند تعديل جدول الجروب

```sql
CREATE TRIGGER trigger_update_group_sessions
AFTER UPDATE OF schedule_day, schedule_time, duration_minutes ON groups
FOR EACH ROW
EXECUTE FUNCTION update_future_sessions();
```

---

## المرحلة الثانية: إكمال السيشنات للمجموعات الموجودة

Migration لإضافة السيشنات الناقصة للمجموعات الحالية:

```sql
DO $$
DECLARE
  group_record RECORD;
  current_max integer;
  target_day integer;
  start_date date;
  day_map jsonb := '{"Sunday":0,"Monday":1,...}';
  i integer;
BEGIN
  FOR group_record IN SELECT * FROM groups WHERE is_active = true LOOP
    SELECT COALESCE(MAX(session_number), 0) INTO current_max 
    FROM sessions WHERE group_id = group_record.id;
    
    IF current_max < 12 THEN
      -- حساب تاريخ البداية وإنشاء السيشنات المتبقية
      ...
    END IF;
  END LOOP;
END $$;
```

---

## المرحلة الثالثة: تحسين واجهة المستخدم (GroupDetails.tsx)

### 1. إضافة زر "إعادة جدولة السيشنات المستقبلية"

```text
+------------------------------------------+
| تقدم المستوى: Level 1                     |
| ████████░░░░  8/12 سيشن (66%)            |
|                                          |
| [🔄 إعادة جدولة السيشنات المستقبلية]       |
+------------------------------------------+
```

### 2. إضافة إمكانية تعديل كل سيشن

في تاب السيشنات، لكل سيشن مجدول:
- زر تعديل التاريخ والوقت
- زر تغيير الحالة (مجدول → ملغي → مكتمل)

### 3. Dialog لإعادة الجدولة

```text
+------------------------------------------+
| إعادة جدولة السيشنات المستقبلية           |
|                                          |
| سيتم تحديث تواريخ السيشنات المستقبلية      |
| بناءً على الجدول الحالي للمجموعة:          |
|                                          |
| اليوم: السبت                              |
| الوقت: 4:00 PM                           |
|                                          |
| [إلغاء]  [تأكيد إعادة الجدولة]            |
+------------------------------------------+
```

---

## المرحلة الرابعة: إضافة Edge Function لإعادة الجدولة اليدوية

للحالات التي تحتاج تحكم يدوي (مثل: المجموعة توقفت مؤقتاً):

```typescript
// supabase/functions/reschedule-sessions/index.ts
// يستقبل group_id ويعيد حساب تواريخ السيشنات المستقبلية
```

---

## الملفات التي ستتأثر

| الملف | التغيير |
|-------|---------|
| `supabase/migrations/...` | إضافة Functions و Triggers وإكمال سيشنات المجموعات الحالية |
| `src/pages/GroupDetails.tsx` | إضافة زر إعادة الجدولة + تعديل السيشنات |
| `supabase/functions/reschedule-sessions/index.ts` | جديد - لإعادة الجدولة اليدوية |

---

## سيناريوهات الاستخدام

### سيناريو 1: إنشاء جروب جديد
```text
Admin ينشئ جروب: "Kojo Squad - Saturday 4:00 PM"
→ Trigger ينشئ 12 سيشن تلقائياً (#1 إلى #12)
→ الجلسات تظهر فوراً في صفحة تفاصيل المجموعة
```

### سيناريو 2: تغيير يوم أو وقت الجروب
```text
Admin يغير اليوم من Saturday إلى Sunday
→ Trigger يحدث السيشنات المستقبلية (scheduled فقط)
→ السيشنات المكتملة (completed) تبقى كما هي
```

### سيناريو 3: إعادة جدولة يدوية
```text
المجموعة توقفت أسبوعين
→ Admin يضغط "إعادة جدولة السيشنات المستقبلية"
→ السيشنات المتبقية تتحدث من التاريخ الحالي
```

### سيناريو 4: تعديل سيشن معين
```text
طالب لديه امتحان يوم السيشن #5
→ Admin يعدل تاريخ السيشن #5 يدوياً
→ باقي السيشنات لا تتأثر
```

---

## ملخص المميزات

1. **تلقائي 100%**: 12 سيشن تُنشأ فوراً عند إنشاء الجروب
2. **ذكي**: تغيير الجدول يحدث السيشنات المستقبلية تلقائياً
3. **آمن**: السيشنات المكتملة لا تتأثر أبداً
4. **مرن**: زر إعادة الجدولة اليدوية + تعديل سيشن معين
5. **متوافق**: المجموعات الحالية ستُكمَل سيشناتها

