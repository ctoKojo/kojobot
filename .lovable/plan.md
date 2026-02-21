

# تحويل اسناد الكويزات والواجبات من مستوى المجموعة الى مستوى الطالب الفردي

---

## المشكلة الحالية

حاليا عند اسناد كويز او واجب من المنهج، يتم انشاء سجل واحد مربوط بـ `group_id`. هذا يعني ان **كل طلاب المجموعة** يحصلون على المهمة بما فيهم الغائبين. الطالب الغائب لا يجب ان يستلم مهام سيشن لم يحضرها - سيستلمها لاحقا من خلال السيشن التعويضية.

---

## الحل: اسناد فردي للحاضرين فقط

بدل انشاء سجل واحد بـ `group_id`، ننشئ سجل **لكل طالب حاضر** بـ `student_id`.

---

## الخطوة 1: تعديل `handleAssignCurriculumQuiz` في `SessionDetails.tsx`

### الكود الحالي (سطر 533-543):
ينشئ سجل واحد:
```text
await supabase.from('quiz_assignments').insert({
  quiz_id, session_id, group_id, assigned_by, ...
});
```

### الكود الجديد:
اذا الحضور مسجل بالفعل، اسناد فردي للحاضرين فقط. اذا لم يسجل بعد، يبقى على مستوى المجموعة (السلوك الحالي).

```text
const hasAttendance = students.some(s => s.attendance_status !== null);

if (hasAttendance) {
  const presentStudents = students.filter(s => 
    s.attendance_status === 'present' || s.attendance_status === 'late'
  );
  
  if (presentStudents.length === 0) {
    // رسالة خطأ - لا يوجد حاضرون
    return;
  }

  // اسناد فردي لكل طالب حاضر
  const records = presentStudents.map(s => ({
    quiz_id: curriculumContent.quiz_id,
    session_id: session.id,
    student_id: s.student_id,  // فردي بدل group_id
    assigned_by: user.id,
    start_time: startDate.toISOString(),
    due_date: dueDate.toISOString(),
    curriculum_snapshot: snapshot,
  }));
  
  const { error } = await supabase.from('quiz_assignments').insert(records);
} else {
  // الحضور لم يسجل - اسناد على مستوى المجموعة (الحالي)
  await supabase.from('quiz_assignments').insert({
    quiz_id, session_id, group_id, assigned_by, ...
  });
}
```

---

## الخطوة 2: تعديل `handleAssignCurriculumAssignment` في `SessionDetails.tsx`

نفس المنطق بالظبط:

```text
if (hasAttendance) {
  const presentStudents = students.filter(s => 
    s.attendance_status === 'present' || s.attendance_status === 'late'
  );
  
  if (presentStudents.length === 0) return;

  // اسناد فردي لكل طالب حاضر
  const records = presentStudents.map(s => ({
    title, title_ar, description, description_ar,
    max_score, due_date, session_id,
    student_id: s.student_id,  // فردي
    assigned_by: user.id,
    attachment_url, attachment_type,
    curriculum_snapshot: snapshot,
  }));
  
  const { error } = await supabase.from('assignments').insert(records);
} else {
  // الحالي - group_id
}
```

---

## الخطوة 3: السيشن التعويضية تسند مهامها لطالبها تلقائيا

في السيشن التعويضية (`is_makeup = true`)، الطالب الوحيد الحاضر هو طالب التعويضية. لذلك نفس المنطق اعلاه سيعمل تلقائيا:
- الحضور مسجل (طالب واحد حاضر)
- الاسناد فردي لهذا الطالب
- لا حاجة لمنطق خاص اضافي

---

## الملفات المتأثرة

| الملف | التعديل |
|---|---|
| `src/pages/SessionDetails.tsx` | تحويل `handleAssignCurriculumQuiz` و `handleAssignCurriculumAssignment` من اسناد group_id الى اسناد فردي student_id عند وجود حضور مسجل |

---

## السيناريوهات

**سيشن عادية - 4 طلاب (2 حاضر + 2 غائب):**
- الكويز والواجب يسندان فقط للطالبين الحاضرين (سجلين بـ student_id)
- الطالبين الغائبين يستلمون مهامهم لاحقا في سيشناتهم التعويضية

**سيشن عادية - الحضور لم يسجل بعد:**
- الاسناد على مستوى المجموعة (group_id) كالمعتاد

**سيشن تعويضية - طالب واحد:**
- الحضور مسجل لطالب واحد
- الاسناد فردي لهذا الطالب فقط

**طالبين غابوا - نفس المعاد التعويضي:**
- كل واحد له سيشن تعويضية منفصلة (سجلين مختلفين في sessions)
- كل سيشن تسند مهامها لطالبها

**طالبين غابوا - معاد مختلف:**
- نفس المنطق - كل واحد في سيشنته يستلم مهامه

