
# تحويل الكويز ليكون جزء من المنهج -- خطة التنفيذ النهائية

## الهدف
الكويز يتعمل مباشرة من داخل سيشن المنهج (زي الواجب بالظبط). مفيش إنشاء يدوي مستقل.

---

## الخطوة 1: Migration -- إنشاء RPCs

### RPC: `create_curriculum_quiz`
- يستخدم `auth.uid()` (مش parameter) للأمان
- يتحقق `has_role(auth.uid(), 'admin')` صراحة
- `SET search_path = 'public'`
- `SELECT ... FOR UPDATE` على `curriculum_sessions` لمنع race conditions
- لو `quiz_id IS NOT NULL` يرجع error: `'Session already has a quiz attached'`
- ينشئ record في `quizzes` بنفس `age_group_id` و `level_id` من السيشن
- العنوان التلقائي: `'Quiz - Session X'` / `'كويز - سيشن X'`
- القيم الافتراضية: `duration_minutes = 30`, `passing_score = 60`
- يحدث `curriculum_sessions.quiz_id` و `updated_at = now()`
- يرجع `jsonb` فيه `quiz_id` الجديد
- صلاحية `EXECUTE` للـ `authenticated` فقط

### RPC: `unassign_curriculum_quiz`
- يستخدم `auth.uid()` + `has_role` admin check
- يستقبل `p_session_id` و `p_expected_quiz_id`
- `SET search_path = 'public'`
- يعمل `SELECT ... FOR UPDATE` على `curriculum_sessions`
- optimistic check: `quiz_id = p_expected_quiz_id`
- لو مطابق: `quiz_id = null`, `updated_at = now()`, يرجع `{unassigned: true}`
- لو مش مطابق: يرجع `{unassigned: false, reason: 'conflict'}`
- الكويز نفسه يفضل موجود في `quizzes` (مش بيتحذف -- يحافظ على التاريخ والتقارير)

---

## الخطوة 2: تعديل `SessionEditDialog.tsx`

### إزالة
- Props: `filteredQuizzes` و `allQuizzesCount`
- الـ `Select` dropdown لاختيار كويز
- زرار "جديد" اللي بيفتح `/quizzes`
- icons: `Plus` (مش محتاجينه بعد كدا)

### تاب الكويز الجديد

**لو مفيش كويز (`session.quiz_id` = null):**
- زرار واحد "إنشاء كويز لهذا السيشن" مع loading state (يمنع double click)
- يستدعي RPC `create_curriculum_quiz({ p_session_id })`
- بعد النجاح: navigate لـ `/quiz-editor/{quizId}?origin=curriculum&sessionId=...&ageGroupId=...&levelId=...`
- لو error: toast بالرسالة (مثلا "Session already has a quiz attached")

**لو فيه كويز مربوط:**
- State داخلي يحمل بيانات الكويز (fetch عند فتح التاب)
- عرض اسم الكويز (editable input) + زرار reset للاسم الافتراضي (`Quiz - Session {session_number}`)
- حقول editable: المدة (دقيقة)، درجة النجاح (%)
- عدد الأسئلة (من count على `quiz_questions`)
- زرار "تعديل الأسئلة" -- navigate مع query params للـ origin
- زرار "إلغاء ربط الكويز" -- مع AlertDialog confirm -- يستدعي `unassign_curriculum_quiz`
- تحديث اعدادات الكويز (title, duration, passing_score) يتم ضمن `handleSave` الموجود عبر `supabase.from('quizzes').update(...)` قبل استدعاء `update_curriculum_session`

---

## الخطوة 3: تعديل `CurriculumManagement.tsx`

- إزالة `useQuery` بـ key `['quizzes-list']` (الخاص بـ `allQuizzes`)
- إزالة متغير `filteredQuizzes`
- إزالة props `filteredQuizzes` و `allQuizzesCount` من `<SessionEditDialog>`

---

## الخطوة 4: تحويل `Quizzes.tsx` لعرض فقط

### إزالة
- زرار "إضافة كويز" (`Plus` button + `kojo-gradient`)
- Dialog إنشاء/تعديل الكويز بالكامل (state: `isDialogOpen`, `editingQuiz`, `formData`)
- `handleSubmit`, `handleEdit`, `handleDelete`, `resetForm`
- من القائمة المنسدلة: إزالة "تعديل" و "حذف"

### إضافة
- رسالة توضيحية أعلى الصفحة (Alert): "الكويزات تُنشأ من داخل المنهج" / "Quizzes are created from within the curriculum"
- لكل كويز عرض curriculum label من `curriculumMap` الموجود (session_number + age group + level)
- لو الكويز unlinked يظهر badge "غير مربوط"
- الإبقاء على: البحث، فلتر linked/unlinked، التقارير، navigate لمحرر الأسئلة

---

## الخطوة 5: تعديل `QuizEditor.tsx`

### زرار رجوع ذكي
- يقرا `useLocation().state` أولا (لو navigate مع state)
- fallback: يقرا `useSearchParams()` -- query params (`origin`, `sessionId`, `ageGroupId`, `levelId`)
- لو `origin === 'curriculum'`: يرجع لـ `/curriculum` (وممكن يحدد age group/level عبر state)
- لو مفيش origin: يرجع لـ `/quizzes` (السلوك الحالي)

### Activity logging
- بعد حفظ الأسئلة بنجاح: `logUpdate('quiz', quizId, { questions_count: questions.length })`

---

## ملخص الملفات المتأثرة

| الملف | التغيير |
|-------|---------|
| Migration SQL | RPC `create_curriculum_quiz` + `unassign_curriculum_quiz` |
| `src/components/curriculum/SessionEditDialog.tsx` | إعادة بناء تاب الكويز -- إزالة select dropdown، إضافة create/unassign/edit flow |
| `src/pages/CurriculumManagement.tsx` | إزالة quiz query و props (3 أسطر) |
| `src/pages/Quizzes.tsx` | تحويل لعرض فقط -- إزالة CRUD، إضافة info alert |
| `src/pages/QuizEditor.tsx` | زرار رجوع ذكي (state + query params fallback) + activity logging |

## ما لن يتغير
- جدول `quizzes` (نفس الهيكل)
- جدول `quiz_questions` (نفس الهيكل)
- آلية الإسناد في SessionDetails (one-click assign من الكويز المرتبط بالمنهج)
- تجربة الطالب في حل الكويز
- QuizResultsDialog و StudentQuizPreviewDialog
- صفحة التقارير

## ترتيب التنفيذ
1. Migration (RPCs)
2. SessionEditDialog (تاب الكويز الجديد)
3. CurriculumManagement (إزالة props)
4. Quizzes (read-only)
5. QuizEditor (back logic + logging)
