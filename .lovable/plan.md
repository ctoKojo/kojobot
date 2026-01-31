

# خطة تتبع السيشنات حسب المستوى (Level Progress Tracking)

## الفكرة الأساسية

كل مجموعة (Group) مرتبطة بمستوى (Level) معين، وكل مستوى يتكون من **12 سيشن**. الهدف هو:
1. تتبع رقم السيشن الحالي في المستوى لكل مجموعة
2. معرفة تقدم المجموعة (وصلت للسيشن كام من 12)
3. تتبع الحضور لكل سيشن بالتفصيل
4. عرض إحصائيات شاملة

---

## التغييرات المطلوبة

### 1. تحديث قاعدة البيانات

**إضافة عمود `session_number` لجدول sessions:**
```text
sessions table:
  + session_number (integer) - رقم السيشن في المستوى (1-12)
```

**إضافة جدول لتتبع تقدم المجموعة في المستوى (اختياري للمرونة):**
```text
group_level_progress table:
  - id (uuid)
  - group_id (uuid) -> groups
  - level_id (uuid) -> levels
  - current_session (integer) - السيشن الحالي
  - started_at (timestamp)
  - completed_at (timestamp, nullable)
  - status (enum: in_progress, completed)
```

### 2. تحديث Edge Function لتوليد السيشنات

تعديل `generate-sessions` ليقوم بـ:
- ترقيم السيشنات تلقائياً (1, 2, 3, ... 12)
- عدم تجاوز 12 سيشن لكل مستوى
- إنشاء سيشنات جديدة فقط إذا لم يكتمل المستوى

### 3. تحديث صفحة تفاصيل المجموعة (GroupDetails)

**إضافة قسم تقدم المستوى:**
```text
+------------------------------------------+
|  تقدم المستوى: Level 1                    |
|  ████████░░░░  8/12 سيشن (66%)           |
|                                          |
|  السيشن الحالي: #8                        |
|  السيشنات المتبقية: 4                     |
+------------------------------------------+
```

**تحسين تاب السيشنات ليعرض:**
- رقم السيشن (#1, #2, ...)
- الحالة (مكتمل/مجدول/ملغي)
- عدد الحضور والغياب لكل سيشن
- معدل الحضور الإجمالي

### 4. إضافة عرض ملخص الحضور التفصيلي

**جدول إحصائيات الحضور للطلاب:**
```text
+--------------------------------------------------+
| الطالب          | حضر | غاب | تأخر | معدل الحضور |
+--------------------------------------------------+
| أحمد محمد       |  7  |  1  |  0   |    87.5%    |
| سارة علي        |  6  |  1  |  1   |    75%      |
| محمد خالد       |  8  |  0  |  0   |    100%     |
+--------------------------------------------------+
```

### 5. تحسين واجهة المستخدم

**في صفحة المجموعات (Groups.tsx):**
- إضافة عمود "التقدم" يعرض `سيشن 5/12`
- شريط تقدم بصري

**في صفحة تفاصيل المجموعة (GroupDetails.tsx):**
- كارت تقدم المستوى مع Progress Bar
- تاب جديد للحضور التفصيلي أو دمجه مع تاب الطلاب

---

## التفاصيل التقنية

### Migration 1: إضافة session_number
```sql
ALTER TABLE sessions 
ADD COLUMN session_number integer;

-- تحديث السيشنات الموجودة بالترتيب
WITH numbered AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY group_id 
           ORDER BY session_date
         ) as row_num
  FROM sessions
)
UPDATE sessions 
SET session_number = numbered.row_num
FROM numbered 
WHERE sessions.id = numbered.id;
```

### Migration 2: إنشاء جدول تقدم المستوى (اختياري)
```sql
CREATE TABLE group_level_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id),
  level_id uuid NOT NULL REFERENCES levels(id),
  current_session integer DEFAULT 1,
  total_sessions integer DEFAULT 12,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, level_id)
);

-- RLS Policies
ALTER TABLE group_level_progress ENABLE ROW LEVEL SECURITY;
```

### تحديث generate-sessions Edge Function
```typescript
// إضافة حساب رقم السيشن التالي
const { data: lastSession } = await supabase
  .from('sessions')
  .select('session_number')
  .eq('group_id', group.id)
  .order('session_number', { desc: true })
  .limit(1)
  .single();

const nextSessionNumber = (lastSession?.session_number || 0) + 1;

// التأكد من عدم تجاوز 12 سيشن
if (nextSessionNumber > 12) {
  console.log(`Level complete for ${group.name}`);
  continue;
}

// إضافة session_number عند الإنشاء
await supabase.from('sessions').insert({
  group_id: group.id,
  session_date: sessionDate,
  session_time: group.schedule_time,
  session_number: nextSessionNumber,
  // ...
});
```

### تحديث GroupDetails.tsx

```typescript
// حساب إحصائيات التقدم
const getLevelProgress = () => {
  const completed = sessions.filter(s => s.status === 'completed').length;
  const total = 12;
  return {
    completed,
    total,
    percentage: Math.round((completed / total) * 100),
    current: Math.max(...sessions.map(s => s.session_number || 0))
  };
};

// حساب إحصائيات الحضور لكل طالب
const getStudentAttendanceStats = async () => {
  const { data } = await supabase
    .from('attendance')
    .select('student_id, status')
    .in('session_id', sessions.map(s => s.id));
  
  // تجميع الإحصائيات لكل طالب
  return students.map(student => ({
    ...student,
    present: data.filter(a => a.student_id === student.id && a.status === 'present').length,
    absent: data.filter(a => a.student_id === student.id && a.status === 'absent').length,
    late: data.filter(a => a.student_id === student.id && a.status === 'late').length,
  }));
};
```

---

## الملفات التي سيتم تعديلها

| الملف | التغيير |
|-------|---------|
| `supabase/migrations/...` | إضافة session_number وجدول التقدم |
| `supabase/functions/generate-sessions/index.ts` | ترقيم السيشنات والحد الأقصى 12 |
| `src/pages/GroupDetails.tsx` | إضافة قسم التقدم وإحصائيات الحضور |
| `src/pages/Groups.tsx` | إضافة عمود التقدم |
| `src/integrations/supabase/types.ts` | تحديث تلقائي |

---

## ملخص المميزات الجديدة

1. **ترقيم السيشنات**: كل سيشن له رقم من 1 إلى 12
2. **شريط التقدم**: رؤية مرئية لتقدم المجموعة في المستوى
3. **إحصائيات الحضور التفصيلية**: لكل طالب ولكل سيشن
4. **الحد الأقصى 12 سيشن**: النظام لا يولد سيشنات أكثر من 12 لكل مستوى
5. **تتبع اكتمال المستوى**: معرفة متى تنتهي المجموعة من المستوى

