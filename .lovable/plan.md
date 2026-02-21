

# تحويل السيشنات التعويضية لسيشنات حقيقية - مع كل التحسينات المطلوبة

---

## نظرة عامة

تحويل السيشنات التعويضية من كيان منفصل الى سيشنات حقيقية في جدول `sessions`، مع تطبيق كل التحسينات المعمارية المطلوبة:
- انشاء السيشن عبر RPC ذري (مش فرونت)
- اكتمال التعويضية عبر RPC ذري
- تقييد الحضور في السيشن التعويضية لطالبها فقط
- منع اسناد كويز/واجب لو كل الطلاب غائبين
- تمييز بصري واضح (badge + banner)

---

## الخطوة 1: Database Migration

### ا. تعديل جدول sessions

```text
ALTER TABLE public.sessions ADD COLUMN is_makeup boolean NOT NULL DEFAULT false;
ALTER TABLE public.sessions ADD COLUMN makeup_session_id uuid REFERENCES public.makeup_sessions(id);

-- UNIQUE: كل makeup_session ترتبط بسيشن واحدة فقط
ALTER TABLE public.sessions ADD CONSTRAINT sessions_makeup_session_id_unique 
  UNIQUE (makeup_session_id);

-- CHECK: تناسق is_makeup مع makeup_session_id
ALTER TABLE public.sessions ADD CONSTRAINT sessions_makeup_consistency_check
  CHECK (
    (is_makeup = false AND makeup_session_id IS NULL)
    OR (is_makeup = true AND makeup_session_id IS NOT NULL)
  );

-- Index للاداء
CREATE INDEX idx_sessions_makeup_session_id 
  ON public.sessions(makeup_session_id) WHERE makeup_session_id IS NOT NULL;
```

### ب. RPC `schedule_makeup_session`

```text
CREATE OR REPLACE FUNCTION public.schedule_makeup_session(
  p_makeup_id uuid,
  p_date date,
  p_time time,
  p_instructor_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
```

المنطق:
1. `SELECT ... FOR UPDATE` على `makeup_sessions`
2. التحقق ان الحالة `pending` او `scheduled` (مش `completed`/`cancelled`)
3. التحقق من عدم وجود session مربوطة بالفعل (unique constraint يحمي برضه)
4. جلب بيانات المجموعة (`duration_minutes`, `group_id`)
5. جلب `session_number` من `makeup_sessions.original_session_id` -> `sessions.session_number`
6. تحديث `makeup_sessions` (date, time, status='scheduled', instructor, reset student_confirmed)
7. انشاء سجل `sessions` (is_makeup=true, makeup_session_id, topic='Makeup Session')
8. ارجاع `{session_id, makeup_id, scheduled_date, scheduled_time}`

**اذا كانت مجدولة بالفعل (status='scheduled')**: يتم تحديث التاريخ/الوقت في كلا الجدولين (reschedule).

### ج. RPC `complete_makeup_session`

```text
CREATE OR REPLACE FUNCTION public.complete_makeup_session(
  p_session_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
```

المنطق:
1. `SELECT ... FOR UPDATE` على `sessions` + التحقق ان `is_makeup = true`
2. التحقق ان الحالة ليست `completed` بالفعل
3. جلب `makeup_session_id` من السيشن
4. تحديث `sessions.status = 'completed'`
5. تحديث `makeup_sessions.status = 'completed'`, `completed_at = now()`
6. جلب `student_id` و `original_session_id` من `makeup_sessions`
7. تحديث `attendance.compensation_status = 'compensated'` في السيشن الاصلية
8. ارجاع `{completed: true, student_id, original_session_id}`

### د. تعديل `save_attendance` - تقييد الحضور في التعويضية

اضافة validation داخل `save_attendance` RPC الموجود:

بعد قفل السيشن، نتحقق اذا كانت تعويضية:

```text
-- بعد Lock + Validate session (سطر 230-239 في الـ RPC)
IF v_is_makeup THEN
  -- جلب student_id من makeup_sessions
  SELECT ms.student_id INTO v_makeup_student_id
  FROM makeup_sessions ms WHERE ms.id = v_makeup_session_id;
  
  -- التحقق ان كل الطلاب في p_records هم فقط الطالب المعني
  FOR v_rec IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    IF (v_rec->>'student_id')::UUID != v_makeup_student_id THEN
      RAISE EXCEPTION 'Makeup session attendance can only be recorded for the assigned student';
    END IF;
  END LOOP;
END IF;
```

هذا يضمن ان حتى لو الفرونت ارسل بيانات خاطئة، الداتابيز يرفضها.

---

## الخطوة 2: تعديل `MakeupSessions.tsx`

### ا. `handleSaveSchedule` (سطر 275-331)

استبدال التحديث المباشر لـ `makeup_sessions` بـ RPC:

```text
const { data, error } = await supabase.rpc('schedule_makeup_session', {
  p_makeup_id: selectedSession.id,
  p_date: scheduleForm.date,
  p_time: scheduleForm.time,
  p_instructor_id: scheduleForm.instructorId || null,
  p_notes: scheduleForm.notes || null,
});
```

باقي المنطق (اشعارات الطالب والمدرب) يبقى كما هو بعد نجاح الـ RPC.

### ب. `handleUpdateStatus` (سطر 333-359)

عند `completed`: نجلب الـ session المربوطة ونستدعي `complete_makeup_session` RPC بدل التحديث المباشر.

عند `expired`: يبقى تحديث مباشر لـ `makeup_sessions` فقط (لا يحتاج مزامنة).

---

## الخطوة 3: تعديل `Sessions.tsx`

### ا. Session interface (سطر 53-64)

اضافة:
```text
is_makeup: boolean;
makeup_session_id: string | null;
```

### ب. عرض badge تعويضية

في mobile view (سطر 698 بعد status badge):
```text
{session.is_makeup && (
  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 text-xs">
    {isRTL ? 'تعويضية' : 'Makeup'}
  </Badge>
)}
```

في desktop view (سطر 818 بعد `getStatusBadge`):
```text
{session.is_makeup && (
  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 text-xs ml-1">
    {isRTL ? 'تعويضية' : 'Makeup'}
  </Badge>
)}
```

---

## الخطوة 4: تعديل `SessionDetails.tsx`

### ا. Session interface (سطر 112-122)

اضافة `is_makeup: boolean` و `makeup_session_id: string | null`.

### ب. banner تعويضية (بعد سطر 969 - بعد navigation header)

```text
{session.is_makeup && (
  <Card className="border-purple-300 bg-purple-50 dark:bg-purple-900/10 dark:border-purple-800">
    <CardContent className="flex items-center gap-3 py-3">
      <RefreshCw className="h-5 w-5 text-purple-600 dark:text-purple-400" />
      <div>
        <p className="font-medium text-purple-800 dark:text-purple-300">
          {isRTL ? 'سيشن تعويضية' : 'Makeup Session'}
        </p>
        <p className="text-sm text-purple-600 dark:text-purple-400">
          {isRTL ? 'هذه السيشن بديلة عن سيشن سابقة' : 'This session replaces a previous one'}
        </p>
      </div>
    </CardContent>
  </Card>
)}
```

### ج. منع اسناد كويز/واجب لو كل الطلاب غائبين

في `handleAssignCurriculumQuiz` (سطر 464) و `handleAssignCurriculumAssignment` (سطر 512)، في البداية:

```text
const hasAttendance = students.some(s => s.attendance_status !== null);
if (hasAttendance) {
  const presentStudents = students.filter(s => 
    s.attendance_status === 'present' || s.attendance_status === 'late'
  );
  if (presentStudents.length === 0) {
    toast({
      title: isRTL ? 'لا يمكن الاسناد' : 'Cannot Assign',
      description: isRTL 
        ? 'لا يوجد طلاب حاضرون لاسناد المهمة لهم' 
        : 'No present students to assign to',
      variant: 'destructive',
    });
    return;
  }
}
```

### د. تقييد attendance dialog للسيشن التعويضية

في فتح الـ attendance dialog (سطر 1619-1672):

اذا `session.is_makeup`، نعرض فقط الطالب المعني بدل كل طلاب المجموعة. نجلب `student_id` من `makeup_sessions` المربوطة ونفلتر `students` بناء عليه.

اضافة state لتخزين الطالب المعني:
```text
const [makeupStudentId, setMakeupStudentId] = useState<string | null>(null);
```

في `fetchSessionData`: اذا السيشن تعويضية، نجلب `student_id` من `makeup_sessions`:
```text
if (sessionData.is_makeup && sessionData.makeup_session_id) {
  const { data: makeupData } = await supabase
    .from('makeup_sessions')
    .select('student_id')
    .eq('id', sessionData.makeup_session_id)
    .single();
  setMakeupStudentId(makeupData?.student_id || null);
}
```

في attendance dialog: فلترة الطلاب المعروضين:
```text
const attendanceStudents = session.is_makeup && makeupStudentId
  ? students.filter(s => s.student_id === makeupStudentId)
  : students;
```

واستخدام `attendanceStudents` بدل `students` في الـ dialog rendering وفي `markAllAs`.

### ه. مزامنة اكتمال التعويضية

في `checkAndUpdateSessionStatus` (سطر 216-238): بعد تحديث حالة السيشن، اذا تعويضية:

```text
if (session.is_makeup && session.id) {
  await supabase.rpc('complete_makeup_session', { p_session_id: session.id });
}
```

---

## الملفات المتأثرة

| الملف | التعديل |
|---|---|
| Migration SQL | اعمدة + constraints + index + RPC `schedule_makeup_session` + RPC `complete_makeup_session` + تعديل `save_attendance` |
| `src/pages/MakeupSessions.tsx` | استخدام RPCs بدل التحديث المباشر |
| `src/pages/Sessions.tsx` | interface + badge تعويضية |
| `src/pages/SessionDetails.tsx` | interface + banner + فلترة attendance + منع اسناد + مزامنة اكتمال |

---

## الضمانات

1. **UNIQUE** على `makeup_session_id` - لا ازدواج
2. **CHECK** على `is_makeup`/`makeup_session_id` - لا بيانات ناقصة
3. **`schedule_makeup_session` RPC** - لا partial updates عند الجدولة
4. **`complete_makeup_session` RPC** - تحديث ذري لـ 3 جداول
5. **`save_attendance` validation** - رفض حضور لغير طالب التعويضية (database-level)
6. **فلترة الفرونت** - عرض طالب واحد فقط في attendance dialog للتعويضية
7. **فحص الحضور** - منع اسناد كويز/واجب لو كل الطلاب غائبين

