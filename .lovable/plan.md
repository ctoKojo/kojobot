

# تنظيف النظام القديم + اصلاح تتبع تقدم الطالب

---

## المشاكل المكتشفة

### 1. ازرار النظام القديم لا تزال ظاهرة في SessionDetails
في `src/pages/SessionDetails.tsx` (سطر 1398-1444) يوجد قسم "Add Session Content" يعرض زرين:
- "استيراد كويز من البنك" (Import Quiz from Bank)
- "انشاء واجب" (Create Assignment)

هذه الازرار هي النظام القديم ويجب ازالتها لان الاسناد اصبح يتم من المنهج بضغطة واحدة.

### 2. صفحة MyInstructorQuizzes لا تزال تسمح بالاسناد المستقل
صفحة `/my-quizzes` (MyInstructorQuizzes.tsx) تحتوي على:
- تبويب "الكويزات المتاحة" مع زر "اسناد" لكل كويز - يسمح للمدرب باسناد كويز لمجموعة بشكل مستقل عن المنهج
- Dialog اختيار مجموعة + وقت بداية

يجب تحويل هذه الصفحة الى **عرض فقط** (نتائج الكويزات المسندة) بدون امكانية اسناد مستقل.

### 3. تقدم الطالب يعتمد على بيانات خاطئة
في `StudentDashboard.tsx` (سطر 161-173) التقدم يُحسب من جدول `group_level_progress` الذي يتتبع تقدم **المجموعة** وليس حضور **الطالب** الفعلي. هذا يعني ان الطالب يرى تقدم المجموعة لا تقدمه الشخصي.

يجب تغيير المصدر الى جدول `attendance` لحساب عدد السيشنات التي **حضرها الطالب فعلا**.

---

## التعديلات المطلوبة

### الملف 1: `src/pages/SessionDetails.tsx`

**حذف قسم "Add Session Content" بالكامل** (سطر 1398-1444):
- ازالة قسم الـ Card الذي يحتوي على "استيراد كويز من البنك" و "انشاء واجب"
- ازالة الـ Dialog الخاص باستيراد الكويز (Import Quiz Dialog)
- ازالة الـ Dialog الخاص بانشاء الواجب (Assignment Dialog)
- ازالة الدوال المرتبطة: `handleImportQuiz`, `handleSaveAssignment`, `fetchAvailableQuizzes`
- ازالة الـ state المرتبط: `importDialogOpen`, `assignmentDialogOpen`, `selectedQuizId`, `quizStartTime`, `assignmentForm`, `assignmentFile`, etc.

**الابقاء على**:
- ازرار المنهج (اسناد كويز/واجب المنهج بضغطة واحدة) - هذه هي الطريقة الجديدة
- ازرار التعديل والحذف للكويز/الواجب المُسند بالفعل (للادمن)

### الملف 2: `src/pages/MyInstructorQuizzes.tsx`

**تحويل الصفحة الى عرض نتائج فقط**:
- ازالة تبويب "الكويزات المتاحة" (Available Quizzes) بالكامل
- ازالة Dialog الاسناد + دالة `handleAssignQuiz` + `openAssignDialog`
- الابقاء على تبويب "اسناداتي ونتائجي" كمحتوى رئيسي (بدون tabs)
- تغيير عنوان الصفحة من "اسناد الكويزات" الى "نتائج الكويزات"
- الابقاء على: عرض النتائج + تفاصيل اجابات الطلاب + حذف الاسناد

### الملف 3: `src/components/dashboard/StudentDashboard.tsx`

**اصلاح حساب التقدم**:
- بدلا من الاعتماد على `group_level_progress.current_session`
- حساب التقدم من `attendance` مباشرة: عدد السيشنات التي حضرها الطالب (status = present او late) + السيشنات المُعوَّضة (compensation_status = compensated)
- الاستعلام يربط `attendance` مع `sessions` لجلب `session_number`
- النتيجة: عدد session_numbers الفريدة التي حضرها / 12

---

## التفاصيل التقنية

### SessionDetails - الكود المحذوف

```text
سطر 1398-1444: قسم "Actions for adding quiz/assignment" بالكامل
سطر 607-655: دالة handleImportQuiz
سطر 657-750: دالة handleSaveAssignment  
سطر 501-508: دالة fetchAvailableQuizzes
الـ Dialogs المرتبطة في نهاية الملف (Import Quiz Dialog + Assignment Dialog)
State variables: importDialogOpen, assignmentDialogOpen, selectedQuizId, quizStartTime, assignmentForm, assignmentFile, availableQuizzes, etc.
```

### StudentDashboard - منطق التقدم الجديد

```text
// بدلا من group_level_progress
const { data: studentAttendance } = await supabase
  .from('attendance')
  .select('session_id, status, compensation_status, sessions!inner(session_number, group_id)')
  .eq('student_id', user?.id)
  .in('status', ['present', 'late']);

// + السيشنات المعوضة
const { data: compensatedAttendance } = await supabase
  .from('attendance')
  .select('session_id, sessions!inner(session_number)')
  .eq('student_id', user?.id)
  .eq('compensation_status', 'compensated');

// حساب السيشنات الفريدة المحضورة
const attendedSessionNumbers = new Set([
  ...studentAttendance.map(a => a.sessions.session_number),
  ...compensatedAttendance.map(a => a.sessions.session_number)
]);

levelProgress = { completed: attendedSessionNumbers.size, total: 12 };
```

---

## الملفات المتأثرة

| الملف | نوع التعديل |
|---|---|
| `src/pages/SessionDetails.tsx` | حذف: قسم Add Content + Import Dialog + Assignment Dialog + الدوال والـ state المرتبطة |
| `src/pages/MyInstructorQuizzes.tsx` | تبسيط: ازالة تبويب الاسناد + Dialog + تغيير العنوان |
| `src/components/dashboard/StudentDashboard.tsx` | اصلاح: حساب التقدم من attendance بدل group_level_progress |

