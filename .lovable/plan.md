
# خطة: دمج إدارة نتائج الكويزات والواجبات داخل صفحة السيشن

## الهدف
تحويل صفحة تفاصيل السيشن (Session Profile) لتصبح لوحة تحكم موحدة لكل ما يخص السيشن، بحيث يستطيع المدرب:
- رؤية من امتحن الكويز ومن لم يمتحن
- عرض نتائج ومعاينة إجابات كل طالب
- رؤية من سلّم الواجب ومن لم يسلم  
- تصحيح الواجبات مباشرة

---

## التغييرات المطلوبة

### 1. إضافة Dialog لعرض نتائج الكويز التفصيلية

**الوظائف:**
- عرض قائمة الطلاب مع حالة كل واحد (لم يبدأ / جاري / مكتمل)
- عرض الدرجة والنسبة المئوية لكل طالب
- زر لمعاينة إجابات الطالب التفصيلية
- إحصائيات عامة (نسبة الإكمال، متوسط الدرجات، الناجحين)

**State جديدة:**
```typescript
const [quizResultsDialogOpen, setQuizResultsDialogOpen] = useState(false);
const [quizStudentResults, setQuizStudentResults] = useState<StudentQuizResult[]>([]);
const [loadingQuizResults, setLoadingQuizResults] = useState(false);
const [selectedStudentForPreview, setSelectedStudentForPreview] = useState<any>(null);
const [questionDetails, setQuestionDetails] = useState<QuestionDetail[]>([]);
```

### 2. إضافة Dialog لعرض تسليمات الواجب

**الوظائف:**
- عرض قائمة الطلاب مع حالة التسليم (لم يسلم / في انتظار التقييم / تم التقييم)
- عرض الدرجات للمقيّمين
- زر للتصحيح/العرض لكل تسليم

**State جديدة:**
```typescript
const [assignmentSubmissionsDialogOpen, setAssignmentSubmissionsDialogOpen] = useState(false);
const [assignmentSubmissions, setAssignmentSubmissions] = useState<AssignmentSubmission[]>([]);
const [loadingSubmissions, setLoadingSubmissions] = useState(false);
```

### 3. إضافة Dialog لتصحيح الواجب من داخل السيشن

**الوظائف:**
- عرض محتوى تسليم الطالب (نص + ملف مرفق)
- إدخال الدرجة والملاحظات
- إمكانية طلب إعادة التسليم
- حفظ التقييم وإرسال إشعار للطالب

**State جديدة:**
```typescript
const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
const [gradeForm, setGradeForm] = useState({ score: '', feedback: '', feedback_ar: '' });
const [savingGrade, setSavingGrade] = useState(false);
```

### 4. تحديث كاردات الإحصائيات

**التحسينات:**
- جعل كارد الكويز قابل للضغط لفتح dialog النتائج
- جعل كارد الواجب قابل للضغط لفتح dialog التسليمات
- إضافة زر "عرض النتائج" في كل كارد

---

## واجهات البيانات الجديدة

```typescript
interface StudentQuizResult {
  student_id: string;
  student_name: string;
  student_name_ar: string;
  submission_id: string | null;
  score: number | null;
  max_score: number | null;
  percentage: number | null;
  status: 'not_started' | 'in_progress' | 'submitted' | 'graded';
  submitted_at: string | null;
  answers: Record<string, string> | null;
}

interface AssignmentSubmission {
  id: string;
  student_id: string;
  student_name: string;
  student_name_ar: string;
  content: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  status: 'submitted' | 'graded' | 'revision_requested';
  score: number | null;
  submitted_at: string;
  has_submitted: boolean;
}

interface QuestionDetail {
  question_text: string;
  question_text_ar: string;
  options: string[];
  correct_answer: string;
  student_answer: string | null;
  is_correct: boolean;
  points: number;
}
```

---

## الدوال الجديدة

### جلب نتائج الكويز
```typescript
const fetchQuizResults = async () => {
  // 1. جلب كل طلاب المجموعة
  // 2. جلب submissions للكويز المحدد
  // 3. دمج البيانات لعرض حالة كل طالب
};
```

### جلب تسليمات الواجب
```typescript
const fetchAssignmentSubmissions = async () => {
  // 1. جلب كل طلاب المجموعة
  // 2. جلب submissions للواجب المحدد
  // 3. دمج البيانات لعرض حالة كل طالب
};
```

### جلب تفاصيل إجابات الطالب
```typescript
const fetchStudentAnswers = async (studentResult: StudentQuizResult) => {
  // جلب أسئلة الكويز مع الإجابات الصحيحة
  // مقارنتها بإجابات الطالب
};
```

### حفظ تقييم الواجب
```typescript
const handleSaveGrade = async () => {
  // تحديث submission بالدرجة والملاحظات
  // إرسال إشعار للطالب
};
```

---

## تحديث واجهة المستخدم

### كارد الكويز (Quiz Card)
```
┌─────────────────────────────────────────────┐
│ 📝 الكويز                    [تعديل] [حذف] │
├─────────────────────────────────────────────┤
│ اسم الكويز: Quiz 1                          │
│ ━━━━━━━━━━━━━━━━ 5/8 ━━━━━━━━━━━━━━━━      │
│                                             │
│ [👁 عرض النتائج التفصيلية]                  │
└─────────────────────────────────────────────┘
```

### كارد الواجب (Assignment Card)
```
┌─────────────────────────────────────────────┐
│ 📋 الواجب                    [تعديل] [حذف] │
├─────────────────────────────────────────────┤
│ عنوان الواجب: تمرين 1                       │
│ ━━━━━━━━━━━━━━━━ 3/8 ━━━━━━━━━━━━━━━━      │
│                                             │
│ [👁 عرض التسليمات والتصحيح]                 │
└─────────────────────────────────────────────┘
```

### Dialog نتائج الكويز
```
┌─────────────────────────────────────────────┐
│ نتائج كويز: Quiz 1                     [X] │
├─────────────────────────────────────────────┤
│ إكمال: 5/8 | متوسط: 75% | ناجحين: 4        │
├─────────────────────────────────────────────┤
│ الطالب    | الحالة   | الدرجة | النسبة |   │
│───────────┼──────────┼────────┼────────┼───│
│ أحمد     | ✓ مكتمل  | 8/10  | 80%   | 👁 │
│ محمد     | ✓ مكتمل  | 6/10  | 60%   | 👁 │
│ علي      | ⏳ جاري  | -     | -     | -  │
│ سارة     | ○ لم يبدأ | -     | -     | -  │
└─────────────────────────────────────────────┘
```

### Dialog تسليمات الواجب
```
┌─────────────────────────────────────────────┐
│ تسليمات الواجب: تمرين 1                [X] │
├─────────────────────────────────────────────┤
│ تسليمات: 3/8 | مقيّم: 1 | انتظار: 2        │
├─────────────────────────────────────────────┤
│ الطالب    | الحالة      | الدرجة |         │
│───────────┼─────────────┼────────┼─────────│
│ أحمد     | ✓ مقيّم     | 85/100 | [عرض]  │
│ محمد     | ⏳ انتظار   | -      | [تقييم] │
│ علي      | ⏳ انتظار   | -      | [تقييم] │
│ سارة     | ○ لم يسلم   | -      | -       │
└─────────────────────────────────────────────┘
```

### Dialog تصحيح الواجب (داخل السيشن)
```
┌─────────────────────────────────────────────┐
│ تقييم واجب: أحمد                       [X] │
├─────────────────────────────────────────────┤
│ 📄 محتوى التسليم:                          │
│ ┌─────────────────────────────────────┐    │
│ │ نص الإجابة...                        │    │
│ └─────────────────────────────────────┘    │
│ 📎 ملف مرفق: homework.pdf [تحميل]          │
├─────────────────────────────────────────────┤
│ الدرجة: [___] / 100                        │
│ ملاحظات (EN): [________________]           │
│ ملاحظات (AR): [________________]           │
├─────────────────────────────────────────────┤
│ [طلب إعادة تسليم]        [💾 حفظ التقييم] │
└─────────────────────────────────────────────┘
```

---

## الملفات المعدلة

| الملف | نوع التعديل |
|-------|-------------|
| `src/pages/SessionDetails.tsx` | تعديل كبير - إضافة كل الـ Dialogs والدوال الجديدة |

---

## ملخص التغييرات

1. **Quiz Results Dialog** - لعرض من امتحن ومن لم يمتحن مع النتائج
2. **Student Answers Preview** - لمعاينة إجابات كل طالب بالتفصيل
3. **Assignment Submissions Dialog** - لعرض من سلم ومن لم يسلم
4. **Grade Assignment Dialog** - لتصحيح الواجبات من داخل السيشن
5. **تحديث الكاردات** - إضافة أزرار للوصول السريع للنتائج والتسليمات
