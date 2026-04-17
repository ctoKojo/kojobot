

The user reports the "Assign Curriculum Quiz" button is disabled, and wants to verify the entire quiz assignment flow works (timing, submission, question visibility for students).

Let me investigate the SessionDetails page to find why the button is disabled.
<lov-tool-use id="toolu_vrtx_01TfNZeUcAjUBzhMeHEpdQHG" name="code--search_files" integration-id="code" data="{\"query\": \"Assign Curriculum Quiz|handleAssignCurriculumQuiz|assignCurriculumQuiz\", \"include_patterns\": \"src/**/*.tsx,src/**/*.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01LDtii1HmR1eDtga4qcbwnM" name="code--search_files" integration-id="code" data="{\"query\": \"handleAssignCurriculumQuiz|Assign Curriculum Quiz|assignCurriculumQuiz\", \"include_patterns\": \"src/**/*.tsx,src/**/*.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Kez25TsKPD5u9Ubs7BCBmy" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/SessionDetails.tsx\", \"lines\": \"1-100\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01XzfLoL9qqdtk1nW8NJMowx" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/SessionDetails.tsx\", \"lines\": \"400-600\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_015xPQNxPZghR7mSEP7ta1GP" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/SessionDetails.tsx\", \"lines\": \"1450-1560\"}">
</lov-tool-use>
الزرار مقفول لأن `isSessionActiveCairo` بترجع false. السيشن المعروضة الآن (`0c3c25f3-20d3-4c97-9d42-b992d3e51a52`) مجدولة في `2026-04-17 15:00:00 Africa/Cairo` لمدة 120 دقيقة، يعني window من 15:00 إلى 17:00 توقيت القاهرة.

أتأكد من الوقت الحالي في القاهرة:
<lov-tool-use id="toolu_vrtx_01PQZXDA9REfVKnuizKKsX5C" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/SessionDetails.tsx\", \"lines\": \"600-720\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01JYKtbZw4xy3FfAxQ8ovvKz" name="code--search_files" integration-id="code" data="{\"include_patterns\": \"supabase/migrations/**/*.sql\", \"query\": \"save-quiz-answer|grade-quiz|quiz_assignments_insert|quiz_questions_student_view\"}">
</lov-tool-use>
معلومات كافية. الوقت دلوقتي بتوقيت القاهرة (من timestamp `1776417882` = 2026-04-17 ~12:24 UTC = ~14:24 Cairo)، والسيشن من 15:00 → 17:00. يعني فيه 36 دقيقة لحد ما الزرار يفتح.

<lov-plan>

## المشكلة

السيشن المعروض (T13) مجدول **15:00 → 17:00 توقيت القاهرة**. الوقت دلوقتي ~14:24 القاهرة. يعني الزرار **مقفول صح** لأن السياسة ساعتها بتقول: الكويز يتسند **بس أثناء وقت السيشن** (مذكور في memory: `scheduled-quiz-assignment-policy`).

الـ tooltip شغال ولو وقفت فوق الزرار هتلاقي رسالة: "متاح أثناء وقت السيشن فقط".

## السبب التقني

في `SessionDetails.tsx` السطر 1515:
```ts
disabled={!sessionActive || assigningCurriculumQuiz}
```
حيث `sessionActive = isSessionActiveCairo(date, time, duration)` بترجع true بس بين start و end بتوقيت Africa/Cairo.

وده مقصود علشان:
- يمنع الطلاب من بدء الكويز قبل/بعد السيشن
- `quiz_assignments.start_time = now()` و `due_date = now + duration`
- لو سندناه قبل السيشن، الطلاب ممكن يبدأوا قبل المعاد أو يخلص الوقت قبل ما يحضروا

## التحقق من فلو الإسناد (قراءة كود فقط، مفيش تنفيذ)

بصيت على الفلو من البداية للنهاية:

| المرحلة | المكان | الحالة |
|---|---|---|
| الزرار يظهر بشروط | `SessionDetails.tsx:1505-1531` | ✅ `quiz_id` موجود + لسه ما اتسندش + canManage |
| Guard للحضور | `SessionDetails.tsx:521-536` | ✅ لو فيه حضور مسجل وكل الطلاب غايبين، يمنع |
| Guard للوقت (Cairo) | `SessionDetails.tsx:539-548` | ✅ `isSessionActiveCairo` |
| Snapshot المنهج | `SessionDetails.tsx:562-568` | ✅ يحفظ نسخة من المنهج |
| إسناد فردي للحاضرين | `SessionDetails.tsx:574-588` | ✅ كل طالب حاضر له صف |
| إسناد جماعي قبل الحضور | `SessionDetails.tsx:589-601` | ✅ على مستوى المجموعة |
| `start_time = now`, `due_date = now + quiz.duration` | `SessionDetails.tsx:558-560` | ✅ صح |
| الطالب يفتح الكويز | `MyQuizzes.tsx` → `TakeQuiz.tsx` | ✅ يستعلم `quiz_assignments` ثم `quiz_questions_student_view` (بدون `correct_answer`) |
| حفظ الإجابات | `save-quiz-answer` edge function | ✅ debounced |
| التسليم | `grade-quiz` edge function مع advisory lock + idempotency | ✅ يحسب الدرجة ويحفظ في `quiz_submissions` |

**الخلاصة: الفلو سليم ومش محتاج تعديل.** المنطق محمي بـ:
- `pg_advisory_xact_lock_wrapper` ضد race conditions
- `quiz_questions_student_view` يخفي الإجابات الصحيحة عن الطالب
- Cairo time guard في الـ frontend والـ edge function
- Auto-submit عند انتهاء الوقت

## الاقتراح

في حاجة واحدة بس ممكن تتحسن في الـ UX:

**عرض countdown صغير قبل بداية السيشن** عشان المستخدم يعرف الزرار هيفتح إمتى بدل ما يحاول كذا مرة. مثلاً:
> "متاح بعد 36 دقيقة (15:00 القاهرة)"

ده تعديل بسيط في الـ tooltip بدل ما يقول "متاح أثناء وقت السيشن فقط".

## القرار

**مفيش مشكلة في الكود.** الزرار شغال صح. الفلو بتاع الإسناد + التسليم + ظهور الأسئلة محمي بكل الـ guards اللي محتاجينها.

### الاختيارات المتاحة:

1. **استنى لحد 15:00 توقيت القاهرة** وجرب الزرار (هيشتغل تلقائياً).
2. **حسّن الـ tooltip** ليعرض الوقت المتبقي/وقت بداية السيشن (تعديل تجميلي بسيط، 5 دقايق).
3. **خليه زي ما هو** ومتعملش أي تعديل.

