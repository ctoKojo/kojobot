
# إزالة الحقول المزدوجة (عربي/إنجليزي) من كل الفورمات

## المشكلة
حالياً كل الفورمات بتطلب من المستخدم يدخل البيانات مرتين - مرة بالإنجليزي ومرة بالعربي. المطلوب إن المستخدم يدخل البيانات مرة واحدة بس ونفس القيمة تتحفظ في الحقلين (العربي والإنجليزي).

## الحل
إزالة حقول الإدخال المكررة (AR) من الواجهة، وعند الحفظ نسخ نفس القيمة اللي المستخدم دخلها في الحقلين `title` و `title_ar` (ونفس الكلام لـ `name/name_ar`, `description/description_ar`, إلخ).

---

## الملفات المتأثرة (13 ملف)

### 1. `src/pages/Materials.tsx`
- إزالة حقول: Title (AR)، Description (AR)
- إزالة state: `formTitleAr`، `formDescAr`
- عند الحفظ: `title_ar = formTitle`، `description_ar = formDesc`

### 2. `src/pages/AgeGroups.tsx`
- إزالة حقل: الاسم (عربي) / Name (Arabic)
- إزالة `name_ar` من `formData`
- عند الحفظ: `name_ar = formData.name`

### 3. `src/pages/Levels.tsx`
- إزالة حقل: الاسم (عربي)
- عند الحفظ: `name_ar = formData.name`

### 4. `src/pages/Groups.tsx`
- إزالة حقل: اسم المجموعة (عربي)
- عند الحفظ: `name_ar = formData.name`

### 5. `src/pages/Sessions.tsx`
- إزالة حقل: الموضوع (عربي) / Topic (Arabic)
- عند الحفظ: `topic_ar = formData.topic`

### 6. `src/pages/Assignments.tsx`
- إزالة حقول: العنوان (عربي)، الوصف (عربي)
- عند الحفظ: `title_ar = title`، `description_ar = description`

### 7. `src/pages/SessionDetails.tsx`
- إزالة حقول: العنوان (عربي)، الوصف (عربي) في فورم الاساينمنت
- عند الحفظ: نسخ القيم

### 8. `src/pages/Quizzes.tsx`
- إزالة حقول: اسم الكويز (عربي)، الوصف (عربي)
- عند الحفظ: `title_ar = title`، `description_ar = description`

### 9. `src/pages/GradeAssignment.tsx`
- إزالة حقل: ملاحظات (عربي) / Feedback (Arabic)
- عند الحفظ: `feedback_ar = feedback`

### 10. `src/components/session/AssignmentSubmissionsDialog.tsx`
- إزالة حقل: ملاحظات (عربي)
- عند الحفظ: `feedback_ar = feedback`

### 11. `src/components/student/IssueWarningDialog.tsx`
- إزالة حقل: السبب (بالعربية)
- عند الحفظ: `reason_ar = reason`

### 12. `src/components/quiz/QuestionEditor.tsx`
- إزالة حقل: نص السؤال (Arabic) وحقول الخيارات العربية
- عند الحفظ: `question_text_ar = question_text`، الخيارات العربية = الخيارات الإنجليزية

### 13. `src/components/quiz/DraggableQuestionCard.tsx`
- التأكد إنه بيحفظ `question_text_ar = question_text` (ده موجود فعلاً)
- لا حاجة لتعديل لأنه بالفعل بيستخدم حقل واحد

---

## التفاصيل التقنية

### النمط المتبع في كل ملف:

1. **إزالة حقول الإدخال المكررة** من الـ JSX (إزالة الـ Input/Textarea الخاص بالعربي)
2. **إزالة الـ state المكرر** (مثل `formTitleAr`) إن وُجد كـ state منفصل
3. **تعديل دالة الحفظ** بحيث تنسخ القيمة الأصلية للحقل العربي:

```text
عند الحفظ:
  title_ar = title
  name_ar = name
  description_ar = description
  reason_ar = reason
  topic_ar = topic
  feedback_ar = feedback
  question_text_ar = question_text
```

4. **تعديل دالة التعديل (Edit)** بحيث لا تحاول ملء حقل عربي غير موجود
5. **إزالة اللابل "(EN)" / "(English)"** من الحقول المتبقية لأنه مفيش حاجة عربي خلاص

### ملاحظة مهمة
- البيانات الموجودة في قاعدة البيانات مش هتتأثر
- العرض للمستخدمين (طلاب/مدرسين) هيفضل يعمل check على `name_ar` و `name` - بس القيمتين هيبقوا نفس الحاجة
- لو حد عايز يضيف ترجمة في المستقبل، الأعمدة في الداتابيز لسه موجودة
