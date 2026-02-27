

# نظام توليد كويزات بالذكاء الاصطناعي + فصل مواد PDF/Slides حسب الصلاحيات

## ملخص المشروع

بناء نظام متكامل من 5 محاور: فصل المواد حسب الصلاحيات، استخراج نص PDF، توليد كويزات بالذكاء الاصطناعي (عربي فقط + نقاط ثابتة)، تعديلات الواجهة حسب الدور، وحدود الامان.

---

## المرحلة 1: Migration - قاعدة البيانات والتخزين

### 1.1 اضافة حقول لـ curriculum_sessions

```text
ALTER TABLE curriculum_sessions ADD COLUMN student_pdf_path TEXT;
ALTER TABLE curriculum_sessions ADD COLUMN student_pdf_text TEXT;
ALTER TABLE curriculum_sessions ADD COLUMN student_pdf_text_updated_at TIMESTAMPTZ;
ALTER TABLE curriculum_sessions ADD COLUMN student_pdf_filename TEXT;
ALTER TABLE curriculum_sessions ADD COLUMN student_pdf_size INTEGER;
```

- `slides_url` الحالي يبقى كما هو لكن يُعتبر admin-only
- `student_pdf_path` مسار ملف PDF في Storage
- `student_pdf_text` نص مستخرج من PDF للتوليد
- `student_pdf_filename` و `student_pdf_size` لعرض معلومات الملف في الواجهة

### 1.2 Storage Bucket

```text
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-slides-pdf', 'session-slides-pdf', false);
```

سياسات RLS:
- **رفع/حذف**: ادمن فقط (`has_role(auth.uid(), 'admin')`)
- **تحميل**: ادمن + طلاب مسجلين في مجموعات مرتبطة بنفس المنهج (عبر `group_students` -> `groups` -> matching `age_group_id` + `level_id`)

### 1.3 تحديث update_curriculum_session RPC

اضافة الحقول الجديدة (`student_pdf_path`, `student_pdf_filename`, `student_pdf_size`) للـ UPDATE statement. ملاحظة: `student_pdf_text` و `student_pdf_text_updated_at` يتحدثوا فقط من extract-pdf-text edge function.

### 1.4 تحديث get_curriculum_with_access RPC

- للادمن: ترجع كل الحقول شاملة `slides_url`, `student_pdf_path`, `student_pdf_filename`, `student_pdf_size`
- للمدرب: ترجع `slides_url` فقط (بدون PDF)
- للطالب: ترجع `student_pdf_available` (boolean) بدل المسار الفعلي، وتخفي `slides_url`
- حقل جديد `student_pdf_available` = `student_pdf_path IS NOT NULL`

### 1.5 تحديث clone_curriculum RPC

نسخ `student_pdf_path`, `student_pdf_filename`, `student_pdf_size` مع بقية الحقول. لا ننسخ `student_pdf_text` لتوفير المساحة (يُستخرج عند الحاجة).

---

## المرحلة 2: Edge Functions

### 2.1 extract-pdf-text

**ملف**: `supabase/functions/extract-pdf-text/index.ts`

**Config**: `verify_jwt = false` (التحقق داخل الكود)

**Input**: `{ sessionId: string }`

**العملية**:
1. تحقق JWT + دور ادمن
2. Rate limit: 10 طلبات/ساعة (باستخدام `_shared/rateLimit.ts` الموجود)
3. جلب `student_pdf_path` من `curriculum_sessions`
4. تنزيل الملف من Storage باستخدام Service Role
5. ارسال PDF كـ base64 لنموذج Gemini لاستخراج النص (بدل مكتبة pdf-parse لضمان التوافق مع Deno)
6. تنظيف النص: حذف ايميلات وارقام موبايل بـ regex
7. قص النص لاول 20,000 حرف
8. تخزين في `student_pdf_text` + `student_pdf_text_updated_at`

**Output**: `{ extracted: true, textLength: number }`

### 2.2 generate-quiz-questions

**ملف**: `supabase/functions/generate-quiz-questions/index.ts`

**Config**: `verify_jwt = false`

**Input**:
```text
{
  sessionId: string (required)
  questionsCount: number (5-20, default 10)
  ageGroup: string ("6-9" | "10-13" | "14-18")
  difficulty: string ("easy" | "medium" | "hard")
  additionalContext?: string (max 500 chars)
}
```

**العملية**:
1. JWT + admin check
2. Rate limit: 5 طلبات/ساعة لكل ادمن
3. جلب بيانات السيشن: `title_ar`, `description_ar`, `session_number`, `student_pdf_text`
4. تحقق: لو `description_ar` و `student_pdf_text` كلاهما فارغ -> رجع خطأ
5. تجميع السياق للنموذج
6. استدعاء `google/gemini-2.5-flash` عبر Lovable AI Gateway مع Tool Calling

**Tool Calling Schema**:
```text
Tool: generate_mcq_list
Parameters:
  questions: array of {
    question_text_ar: string,
    options_ar: string[] (4 items),
    correct_index: number (0-3),
    rationale?: string,
    tags?: string[]
  }
```

**System Prompt** (ملخص):
- انت مدرس متخصص في تعليم الاطفال البرمجة والتكنولوجيا
- اكتب كل الاسئلة بالعربي فقط
- المصطلحات التقنية الانجليزية مسموحة فقط (variable, loop, function, array, etc.)
- ممنوع جمل كاملة بالانجليزي
- 4 اختيارات فقط، بدون "كل ما سبق"، بدون تلميحات
- تنويع: فهم + تطبيق + تحليل
- اطوال اختيارات متقاربة

**Validation بعد استلام المخرجات**:
- 4 اختيارات بالظبط لكل سؤال
- `correct_index` واحد (0-3)
- لا تكرار في الاختيارات
- فلتر "كل ما سبق" / "لا شيء مما سبق"
- فحص اللغة: whitelist للمصطلحات التقنية، رفض كلمات انجليزية غير مسموحة
- لو فشل: retry واحد مع رسالة تصحيح
- لو فشل تاني: خطأ واضح

**بعد Validation**:
- اضافة `points = FIXED_POINTS` (ثابت = 1) لكل سؤال (من constant في الكود)
- رجع النتيجة

**Output**:
```text
{
  questions: [{
    question_text_ar: string,
    options_ar: string[],
    correct_index: number,
    points: number,
    rationale?: string,
    tags?: string[]
  }]
}
```

### 2.3 get-session-pdf-url (Signed URL للطالب)

**ملف**: `supabase/functions/get-session-pdf-url/index.ts`

**Config**: `verify_jwt = false`

**Input**: `{ sessionId: string }`

**العملية**:
1. JWT check
2. تحقق ان الطالب عضو في مجموعة مرتبطة بنفس المنهج (age_group_id + level_id)
3. جلب `student_pdf_path`
4. توليد signed URL (60 دقيقة)

**Output**: `{ url: string, expiresIn: 3600 }`

---

## المرحلة 3: تعديلات الواجهة

### 3.1 AIGenerateDialog (ملف جديد)

**ملف**: `src/components/quiz/AIGenerateDialog.tsx`

- Dialog يحتوي:
  - عدد الاسئلة (slider 5-20, افتراضي 10)
  - الفئة العمرية (select: 6-9, 10-13, 14-18)
  - مستوى الصعوبة (select: سهل/متوسط/صعب)
  - سياق اضافي (textarea اختياري, max 500)
  - تحذير لو الوصف فاضي: "الوصف مطلوب لجودة الاسئلة"
  - Loading state اثناء التوليد
  - Preview list للاسئلة المولدة
  - زر "اضافة الكل" و "الغاء"

### 3.2 SessionEditDialog - تعديلات

**تاب Content يتغير لـ "مواد" / "Materials":**
- **قسم 1**: رابط السلايدز (للادمن فقط) - يبقى `slides_url`
- **قسم 2**: رفع PDF للطالب
  - Drag & drop area
  - عرض اسم الملف وحجمه بعد الرفع
  - زر استبدال/حذف
  - بعد الرفع: استدعاء `extract-pdf-text` تلقائي
  - مؤشر: "جاري الاستخراج..." / "تم استخراج النص"
- **قسم 3**: فيديو ملخص + فيديو كامل (كما هو)

**تاب Quiz - اضافة زر AI:**
- لو مفيش كويز:
  1. "انشاء كويز فارغ" (الحالي)
  2. "انشاء كويز بالذكاء الاصطناعي" (جديد)
     - ينشئ كويز عبر `create_curriculum_quiz` RPC
     - يستدعي `generate-quiz-questions`
     - يحفظ الاسئلة في `quiz_questions`
     - يفتح QuizEditor

**تنبيه تحديث المحتوى:**
- لو PDF اتغير بعد اخر استخراج: badge "المحتوى اتغير - اعمل استخراج جديد"

### 3.3 QuizEditor - اضافة زر AI

- زر "توليد بالذكاء الاصطناعي" بجانب Excel Import
- يمرر `sessionId` من search params
- يفتح `AIGenerateDialog`
- الاسئلة المولدة تتحول لصيغة `SimplifiedQuestion`:
  - `question_text` = `question_text_ar`
  - `question_text_ar` = `question_text_ar`
  - `options` = `options_ar`
  - `correct_answer` = `correct_index.toString()`
  - `points` = من النتيجة (ثابت)
- Append على الاسئلة الحالية
- **Undo**: حفظ snapshot قبل الاضافة، زر "تراجع عن اخر اضافة"

### 3.4 SessionDetails - فصل العرض حسب الدور

**الطالب** (في قسم Curriculum Content):
- يشوف زر "تحميل PDF" بدل "السلايدات"
- الزر يستدعي `get-session-pdf-url` ويفتح signed URL
- لا يرى `slides_url`

**المدرب**:
- يشوف زر "السلايدات" (slides_url) فقط
- لا يشوف PDF ولا زر توليد

**الادمن**:
- يشوف كل الحاجات

### 3.5 MySessions - فصل العرض للطالب

- استبدال زر "سلايدات" بزر "تحميل PDF"
- الزر يستدعي `get-session-pdf-url`
- اخفاء slides_url

### 3.6 تحديث CurriculumSession interface

اضافة الحقول الجديدة للـ interface في كل الملفات المتأثرة.

---

## المرحلة 4: الامان والحدود

- Rate limit: 5 طلبات/ساعة (generate) + 10 طلبات/ساعة (extract)
- حد اقصى 20 سؤال/طلب
- فلترة بيانات حساسة من النص (ايميلات، ارقام موبايل)
- JWT + admin check في كل Edge Function
- Storage RLS: طلاب المجموعة فقط يحملون PDF
- Points ثابتة (FIXED_POINTS = 1) لا تاتي من الموديل
- Validation صارم على مخرجات الموديل + retry واحد
- فحص لغة: whitelist للمصطلحات التقنية الانجليزية فقط
- Logs: مين طلب + كام سؤال + حجم النص + وقت التنفيذ (بدون محتوى PDF)

---

## التفاصيل التقنية

### الملفات الجديدة (4)
1. `supabase/functions/extract-pdf-text/index.ts`
2. `supabase/functions/generate-quiz-questions/index.ts`
3. `supabase/functions/get-session-pdf-url/index.ts`
4. `src/components/quiz/AIGenerateDialog.tsx`

### الملفات المعدلة (5)
5. `supabase/config.toml` - اضافة 3 functions
6. `src/components/curriculum/SessionEditDialog.tsx` - تاب Materials + PDF upload + AI quiz button
7. `src/pages/QuizEditor.tsx` - زر AI Generate + Undo
8. `src/pages/SessionDetails.tsx` - فصل عرض PDF/Slides حسب الدور
9. `src/pages/MySessions.tsx` - عرض PDF بدل Slides للطالب

### Migration SQL (1)
10. حقول + bucket + RLS + تحديث RPCs

### ترتيب التنفيذ
1. Migration (حقول + bucket + storage RLS + تحديث RPCs)
2. Edge Functions (extract-pdf-text + generate-quiz-questions + get-session-pdf-url)
3. AIGenerateDialog component
4. SessionEditDialog (Materials tab + PDF upload + AI quiz)
5. QuizEditor (AI button + undo)
6. SessionDetails + MySessions (role-based display)

### النموذج المستخدم
- `google/gemini-2.5-flash` عبر LOVABLE_API_KEY
- Tool calling لضمان JSON منظم
- عربي فقط مع whitelist مصطلحات تقنية

### الثوابت
- `FIXED_POINTS = 1` (نقطة واحدة لكل سؤال)
- `MAX_QUESTIONS = 20`
- `MAX_PDF_TEXT_LENGTH = 20000`
- `SIGNED_URL_EXPIRY = 3600` (60 دقيقة)
- `GENERATE_RATE_LIMIT = 5` (في الساعة)
- `EXTRACT_RATE_LIMIT = 10` (في الساعة)

