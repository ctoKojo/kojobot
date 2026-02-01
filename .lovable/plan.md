
# خطة إضافة حقل تاريخ البداية ورقم السيشن عند إنشاء مجموعة

## الفكرة الرئيسية

عند إنشاء مجموعة جديدة، يمكن للمشرف اختيار:
1. **"مجموعة جديدة - تبدأ من السيشن 1"** (افتراضي)
2. **"مجموعة قائمة - تحديد رقم السيشن القادم"** (للمجموعات التي بدأت مسبقاً)

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        إنشاء مجموعة جديدة                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  حالة المجموعة:                                                     │
│  ○ مجموعة جديدة - تبدأ من السيشن 1                                 │
│  ● مجموعة قائمة - بدأت مسبقاً                                       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  السيشن القادم سيكون رقم: [  7  ] ▼                         │   │
│  │                                                              │   │
│  │  📊 ملخص:                                                    │   │
│  │  • فات 6 سيشنات                                              │   │
│  │  • باقي 6 سيشنات                                             │   │
│  │  • التقدم: 50%                                               │   │
│  │                                                              │   │
│  │  تاريخ السيشن القادم: [  📅 اختر التاريخ  ]                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## كيف يعمل النظام؟

### السيناريو 1: مجموعة جديدة
- تبدأ من السيشن 1
- يتم إنشاء 12 سيشن تلقائياً
- `start_date` = أقرب يوم موافق ليوم الجدول

### السيناريو 2: مجموعة قائمة (مثال: السيشن القادم رقم 7)
- المستخدم يختار أن السيشن القادم سيكون رقم 7
- المستخدم يحدد تاريخ هذا السيشن (مثلاً 4 فبراير)
- النظام يُنشئ 6 سيشنات فقط (من 7 إلى 12)
- السيشنات السابقة (1-6) لا يتم إنشاؤها لأنها "فاتت"

---

## التغييرات المطلوبة

### 1. ملف: `src/pages/Groups.tsx`

#### أ) إضافة حقول جديدة في formData (سطر 127-139)

```typescript
const [formData, setFormData] = useState({
  // ... existing fields
  is_existing_group: false,        // هل المجموعة قائمة بالفعل؟
  next_session_number: 1,          // رقم السيشن القادم
  next_session_date: '',           // تاريخ السيشن القادم
});
```

#### ب) إضافة قسم UI جديد في الـ Dialog (بعد حقل session_link ~ سطر 757)

**العناصر المطلوب إضافتها:**
1. Radio buttons للاختيار بين "مجموعة جديدة" و "مجموعة قائمة"
2. Select لاختيار رقم السيشن القادم (1-12)
3. ملخص تلقائي يعرض: (فات X سيشن | باقي Y سيشن | التقدم Z%)
4. Date picker لاختيار تاريخ السيشن القادم

#### ج) تحديث handleSubmit (سطر 358-434)

```typescript
const payload = {
  // ... existing fields
  start_date: formData.is_existing_group 
    ? formData.next_session_date 
    : null,  // null = استخدم أقرب يوم
};

// بعد إنشاء المجموعة، إذا كانت قائمة:
if (!editingGroup && formData.is_existing_group) {
  // انتظر إنشاء السيشنات من trigger
  // ثم احذف السيشنات من 1 إلى (next_session_number - 1)
  // أو حدّث الـ session_number للسيشنات المنشأة
}
```

#### د) تحديث resetForm (سطر 436-450)

```typescript
const resetForm = () => {
  setFormData({
    // ... existing fields
    is_existing_group: false,
    next_session_number: 1,
    next_session_date: '',
  });
};
```

---

### 2. تحديث Database Trigger: `create_group_sessions`

**المشكلة الحالية:** 
الـ trigger ينشئ دائماً 12 سيشن بدءاً من session_number = 1

**الحل:** 
نحتاج إضافة عمود جديد `starting_session_number` للـ groups table

```sql
-- إضافة عمود لتحديد رقم السيشن البداية
ALTER TABLE public.groups 
ADD COLUMN starting_session_number integer DEFAULT 1;

-- تحديث الـ trigger
CREATE OR REPLACE FUNCTION public.create_group_sessions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  day_map jsonb := '{"Sunday":0,...}';
  target_day integer;
  start_date date;
  starting_num integer;
  i integer;
BEGIN
  IF NOT NEW.is_active THEN
    RETURN NEW;
  END IF;
  
  target_day := (day_map ->> NEW.schedule_day)::integer;
  starting_num := COALESCE(NEW.starting_session_number, 1);
  
  -- Use custom start_date if provided
  IF NEW.start_date IS NOT NULL THEN
    start_date := NEW.start_date;
  ELSE
    start_date := CURRENT_DATE;
    WHILE EXTRACT(DOW FROM start_date) != target_day LOOP
      start_date := start_date + 1;
    END LOOP;
  END IF;
  
  -- Create sessions from starting_num to 12
  FOR i IN starting_num..12 LOOP
    INSERT INTO public.sessions (
      group_id, session_date, session_time, 
      duration_minutes, status, session_number
    )
    VALUES (
      NEW.id, 
      start_date + ((i - starting_num) * 7),  -- Calculate date
      NEW.schedule_time, 
      NEW.duration_minutes, 
      'scheduled', 
      i  -- Session number
    );
  END LOOP;
  
  RETURN NEW;
END;
$function$;
```

---

### 3. إضافة imports جديدة في Groups.tsx

```typescript
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
```

---

### 4. إضافة ترجمات في i18n.ts

```typescript
groups: {
  // ... existing
  groupStatus: 'Group Status',
  newGroup: 'New Group - Starts from Session 1',
  existingGroup: 'Existing Group - Already Started',
  nextSessionNumber: 'Next Session Number',
  nextSessionDate: 'Next Session Date',
  sessionsPassed: 'Sessions Passed',
  sessionsRemaining: 'Sessions Remaining',
  progress: 'Progress',
  selectDate: 'Select Date',
}

// Arabic
groups: {
  // ... existing
  groupStatus: 'حالة المجموعة',
  newGroup: 'مجموعة جديدة - تبدأ من السيشن 1',
  existingGroup: 'مجموعة قائمة - بدأت مسبقاً',
  nextSessionNumber: 'رقم السيشن القادم',
  nextSessionDate: 'تاريخ السيشن القادم',
  sessionsPassed: 'سيشنات فاتت',
  sessionsRemaining: 'سيشنات باقية',
  progress: 'التقدم',
  selectDate: 'اختر التاريخ',
}
```

---

## ملخص الملفات المتأثرة

| الملف | نوع التغيير | الوصف |
|-------|------------|-------|
| `src/pages/Groups.tsx` | تعديل | إضافة UI للاختيار بين مجموعة جديدة/قائمة |
| `src/lib/i18n.ts` | تعديل | إضافة ترجمات جديدة |
| Migration (SQL) | إضافة | عمود `starting_session_number` + تحديث trigger |

---

## تجربة المستخدم النهائية

1. المشرف يفتح نموذج إنشاء مجموعة جديدة
2. يختار "مجموعة قائمة - بدأت مسبقاً"
3. يظهر له:
   - قائمة منسدلة لاختيار "السيشن القادم سيكون رقم..." (2-12)
   - ملخص تلقائي: "فات 6 سيشنات | باقي 6 سيشنات | 50%"
   - حقل لاختيار تاريخ السيشن القادم
4. عند الحفظ، يتم إنشاء السيشنات المتبقية فقط
