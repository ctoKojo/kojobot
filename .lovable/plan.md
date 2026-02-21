

# صفحة "سيشناتي" للطلاب - عرض السيشنات المحضورة كمحتوى تعليمي

---

## الفكرة

بدل اضافة الطالب لصفحة `/sessions` الادارية، ننشئ صفحة جديدة `/my-sessions` مخصصة للطلاب تعرض **فقط السيشنات اللي حضرها** كمحتوى تعليمي (سلايدات، فيديوهات) مش كجدول مواعيد.

---

## الخطوة 1: انشاء صفحة `MySessions.tsx`

صفحة جديدة `src/pages/MySessions.tsx` تعرض:

1. جلب مجموعات الطالب من `group_students`
2. جلب كل السيشنات لهذه المجموعات
3. جلب سجلات الحضور للطالب من `attendance`
4. فلترة: عرض فقط السيشنات اللي حضرها (present/late) او تم تعويضها (compensated)
5. لكل سيشن، جلب محتوى المنهج عبر `get_curriculum_with_access` RPC (حسب باقة الطالب)

### شكل الصفحة:

- **هيدر**: "سيشناتي" / "My Sessions"
- **كروت**: كل سيشن كارت يعرض:
  - رقم السيشن + التاريخ + اسم المجموعة
  - العنوان من المنهج
  - ازرار المحتوى (سلايدات / فيديو ملخص / فيديو كامل) حسب باقة الطالب
  - badge "تعويضية" لو كانت makeup session
- **فلتر**: كل السيشنات / حسب المجموعة
- **ترتيب**: من الاحدث للاقدم

### منطق جلب البيانات:

```text
// 1. جلب مجموعات الطالب
const { data: studentGroups } = await supabase
  .from('group_students')
  .select('group_id, groups(name, name_ar, age_group_id, level_id)')
  .eq('student_id', user.id)
  .eq('is_active', true);

// 2. جلب سجلات الحضور للطالب
const { data: attendanceData } = await supabase
  .from('attendance')
  .select('session_id, status, compensation_status')
  .eq('student_id', user.id);

// 3. فلترة السيشنات المحضورة فقط
const attendedSessionIds = attendanceData
  .filter(a => a.status === 'present' || a.status === 'late' || a.compensation_status === 'compensated')
  .map(a => a.session_id);

// 4. جلب بيانات السيشنات المحضورة
const { data: sessionsData } = await supabase
  .from('sessions')
  .select('*')
  .in('id', attendedSessionIds)
  .order('session_date', { ascending: false });

// 5. لكل سيشن، جلب المحتوى حسب الباقة
for (const session of sessionsData) {
  const { data: curriculum } = await supabase.rpc('get_curriculum_with_access', {
    p_age_group_id, p_level_id, p_session_number,
    p_subscription_type, p_attendance_mode
  });
}
```

---

## الخطوة 2: اضافة Route و Sidebar

### `src/App.tsx`:
اضافة route جديد:
```text
<Route path="/my-sessions" element={
  <ProtectedRoute allowedRoles={['student']}>
    <MySessions />
  </ProtectedRoute>
} />
```

### `src/components/AppSidebar.tsx`:
اضافة في قسم "My Learning" للطالب:
```text
{ title: isRTL ? 'سيشناتي' : 'My Sessions', url: '/my-sessions', icon: BookOpen, roles: ['student'] }
```

---

## الخطوة 3: اخفاء المحتوى عن الغائبين في `SessionDetails.tsx`

اذا الطالب فتح سيشن من اي مكان (رابط مباشر مثلا)، نتحقق من حضوره:

### اضافة state:
```text
const [studentCanViewContent, setStudentCanViewContent] = useState(true);
```

### في `fetchSessionData`:
```text
if (role === 'student' && user) {
  const myAttendance = attendanceData?.find(a => a.student_id === user.id);
  if (myAttendance) {
    const isPresent = myAttendance.status === 'present' || myAttendance.status === 'late';
    const isCompensated = myAttendance.compensation_status === 'compensated';
    setStudentCanViewContent(isPresent || isCompensated);
  } else {
    setStudentCanViewContent(true); // لم يسجل حضور بعد
  }
}
```

### في عرض المحتوى (سطر 1177-1315):
لف قسم المحتوى بشرط - اذا `studentCanViewContent = false`:

```text
<Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/10">
  <CardContent className="flex items-center gap-3 py-4">
    <AlertCircle className="h-5 w-5 text-amber-600" />
    <div>
      <p className="font-medium text-amber-800">
        {isRTL ? 'المحتوى غير متاح' : 'Content Not Available'}
      </p>
      <p className="text-sm text-amber-600">
        {isRTL 
          ? 'ستتمكن من مشاهدة محتوى هذه السيشن بعد حضور السيشن التعويضية'
          : 'You can view this content after attending your makeup session'}
      </p>
    </div>
  </CardContent>
</Card>
```

---

## الملفات المتأثرة

| الملف | التعديل |
|---|---|
| `src/pages/MySessions.tsx` | صفحة جديدة - عرض السيشنات المحضورة كمحتوى تعليمي |
| `src/App.tsx` | اضافة route `/my-sessions` للطالب |
| `src/components/AppSidebar.tsx` | اضافة رابط "سيشناتي" في sidebar الطالب |
| `src/pages/SessionDetails.tsx` | اخفاء المحتوى عن الطلاب الغائبين |

---

## جدول الوصول

| حالة الطالب | يظهر في "سيشناتي"؟ | يشوف المحتوى؟ |
|---|---|---|
| حاضر (present/late) | نعم | نعم (حسب الباقة) |
| غائب + لم يتعوض | لا | لا |
| غائب + تم التعويض (compensated) | نعم | نعم (حسب الباقة) |
| لم يسجل حضور بعد | لا | نعم (من SessionDetails) |
| مدرب/ادمن | لا يرى هذه الصفحة | نعم دائما |

