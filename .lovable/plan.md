
# ربط الكويزات بنظام المنهج + رفع ملفات الواجب

---

## الملف 1: `src/pages/CurriculumManagement.tsx`

### أ. رفع ملفات الواجب في Edit Dialog

**State جديد:**
- `assignmentFile: File | null` - الملف المختار
- `uploadingFile: boolean` - حالة الرفع

**تعديل `handleSaveEdit`:**
- قبل الحفظ، اذا `assignmentFile` موجود: رفعه على bucket `curriculum` بمسار `assignments/{age_group_id}/{level_id}/{session_number}/{timestamp}.{ext}`
- حفظ `assignment_attachment_url` و `assignment_attachment_type` ضمن الـ mutation

**UI في قسم الواجب (سطر 604-645):**
- اضافة منطقة رفع ملف بعد حقل الوصف وقبل الدرجة القصوى
- عرض الملف الحالي (اذا `editForm.assignment_attachment_url` موجود) مع زر حذف
- زر اختيار ملف جديد مع عرض اسم الملف المختار
- دعم انواع الملفات: PDF, صور, ZIP

**تعديل `openEditDialog`:**
- اعادة تعيين `assignmentFile` الى `null` عند فتح الـ dialog

### ب. تحسين اختيار الكويز

**فلترة الكويزات (سطر 88-99):**
- تعديل الـ query ليجلب `age_group_id` و `level_id` مع الكويزات
- فلترة القائمة في الـ UI حسب `selectedAgeGroup` و `selectedLevel` المحددين حاليا

**ازرار سريعة بجانب dropdown الكويز (سطر 580-601):**
- زر "انشاء كويز جديد" يفتح `/quiz-editor/new` في تبويب جديد (مع تمرير age_group و level كـ query params)
- زر "تعديل الاسئلة" (يظهر فقط اذا كويز محدد) يفتح `/quiz-editor/{quiz_id}`

---

## الملف 2: `src/pages/Quizzes.tsx`

### اظهار ربط الكويز بالمنهج

**جلب بيانات الربط (في `fetchData`):**
- بعد جلب الكويزات، استعلام اضافي لـ `curriculum_sessions` حيث `quiz_id` يطابق اي كويز
- بناء `Map<quiz_id, {session_number, age_group_name, level_name}>`

**تعديل الجدول:**
- اضافة عمود "المنهج" بعد عمود "الليفل"
- يعرض: اسم الفئة العمرية + الليفل + "سيشن X" اذا مربوط، او badge "غير مربوط"

**فلتر اضافي:**
- اضافة فلتر "الكل / مربوط بالمنهج / غير مربوط" فوق الجدول

**تعديل Mobile Cards:**
- اضافة badge ربط المنهج في كل كارت

---

## الملف 3: `src/pages/SessionDetails.tsx`

### عرض metadata الكويز المربوط

**تعديل قسم Curriculum Content (سطر 1131-1169):**
- عند وجود `curriculumContent.quiz_id`، عرض معلومات اضافية:
  - عدد الاسئلة (من `quiz_questions` count)
  - درجة النجاح (`passing_score`)
  - المدة (`duration_minutes`)
- هذه البيانات تُجلب مع `quizAssignment` الموجود اصلا او باستعلام منفصل عند تحميل المنهج

**UI:**
- عرض badges صغيرة بجانب زر "اسناد كويز المنهج" توضح: "5 اسئلة | 60% للنجاح | 30 دقيقة"

---

## التفاصيل التقنية

### CurriculumManagement - رفع الملف

```text
// في handleSaveEdit
if (assignmentFile) {
  const ext = assignmentFile.name.split('.').pop();
  const fileName = `assignments/${editSession.age_group_id}/${editSession.level_id}/${editSession.session_number}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from('curriculum').upload(fileName, assignmentFile);
  if (uploadError) throw uploadError;
  editForm.assignment_attachment_url = fileName;
  editForm.assignment_attachment_type = assignmentFile.type;
}

// تمرير الحقول في mutation
updateSessionMutation.mutate({
  ...existingFields,
  assignment_attachment_url: editForm.assignment_attachment_url,
  assignment_attachment_type: editForm.assignment_attachment_type,
});
```

### CurriculumManagement - فلترة الكويزات

```text
// تعديل query ليجلب age_group_id و level_id
const { data } = await supabase
  .from('quizzes')
  .select('id, title, title_ar, age_group_id, level_id')
  .eq('is_active', true);

// فلترة في UI
const filteredQuizzes = quizzes.filter(q =>
  (!q.age_group_id || q.age_group_id === selectedAgeGroup) &&
  (!q.level_id || q.level_id === selectedLevel)
);
```

### Quizzes.tsx - جلب ربط المنهج

```text
// استعلام اضافي
const quizIds = quizzes.map(q => q.id);
const { data: curriculumLinks } = await supabase
  .from('curriculum_sessions')
  .select('quiz_id, session_number, age_groups(name, name_ar), levels(name, name_ar)')
  .in('quiz_id', quizIds)
  .eq('is_active', true);
```

---

## الملفات المتأثرة

| الملف | نوع التعديل |
|---|---|
| `src/pages/CurriculumManagement.tsx` | رفع ملف واجب + فلترة كويزات + ازرار انشاء/تعديل كويز |
| `src/pages/Quizzes.tsx` | عمود ربط المنهج + badge + فلتر |
| `src/pages/SessionDetails.tsx` | عرض metadata الكويز (عدد اسئلة + درجة نجاح + مدة) |
