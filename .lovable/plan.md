

# ضبط توقيت إسناد الكويز -- الكويز يبدأ لحظة الإسناد فقط أثناء السيشن

## المشكلة الحالية
- `start_time` بتاع الكويز بيتحط = وقت بداية السيشن النظري (من الجدول)، مش لحظة الإسناد الفعلية
- المدرب يقدر يسند الكويز في أي وقت -- قبل السيشن أو بعدها
- ده بيأثر على عدالة العد التنازلي

## سياسة انتهاء الكويز
الطالب ياخد مدة الكويز كاملة حتى لو السيشن خلصت. يعني `due_date = start_time + duration` دائما.

---

## التغييرات

### 1. إضافة `isSessionActiveCairo` في `src/lib/sessionTimeGuard.ts`

دالة جديدة تستخدم نفس منطق `buildSessionEndParts` و `compareParts` الموجودين:
- تبني start parts من `sessionDate` + `sessionTime`
- تبني end parts من `sessionDate` + `sessionTime` + `durationMinutes`
- تقارن Cairo now مع الاتنين
- ترجع `true` لو: `now >= start` **و** `now < end`
- ترجع `false` على أي input ناقص أو غلط (safe default)

ده بيستخدم نفس الـ `getCairoNowParts()` و `compareParts()` و `buildSessionEndParts()` الموجودين بالفعل، فمحتاج بس دالة parse بسيطة لبداية السيشن + الدالة الجديدة.

### 2. تعديل `handleAssignCurriculumQuiz` في `src/pages/SessionDetails.tsx`

**إضافة guard في أول الدالة:**
```text
if (!isSessionActiveCairo(session.session_date, session.session_time, group.duration_minutes)) {
  toast: "لا يمكن إسناد الكويز إلا أثناء وقت السيشن"
  return
}
```

**تغيير حساب `start_time` و `due_date`:**
- `start_time` = `new Date().toISOString()` (لحظة الإسناد الحقيقية)
- `due_date` = `new Date(now + quiz.duration_minutes * 60000).toISOString()`
- الطالب ياخد مدته كاملة دائما

### 3. تعديل زرار الإسناد في UI (نفس الملف)

الزرار الحالي (سطر 1289-1298) يبقى:
- `disabled` لو السيشن مش active (باستخدام `isSessionActiveCairo`)
- مع `Tooltip` يوضح السبب: "متاح أثناء وقت السيشن فقط" / "Available during session time only"

---

## التفاصيل التقنية

### `isSessionActiveCairo` -- المنطق
```text
function isSessionActiveCairo(sessionDate, sessionTime, durationMinutes): boolean
  1. Parse start parts من sessionDate + sessionTime
  2. Build end parts (start + duration) عبر buildSessionEndParts الموجود
  3. Get Cairo now parts
  4. Return: compareParts(now, start) >= 0 AND compareParts(now, end) < 0
```

### `handleAssignCurriculumQuiz` -- التغيير
```text
// قبل (حاليا سطر 539-540):
const startDate = new Date(`${session.session_date}T${session.session_time.slice(0, 5)}`);
const dueDate = new Date(startDate.getTime() + (quiz?.duration_minutes || 30) * 60 * 1000);

// بعد:
const now = new Date();
const durationMs = (quiz?.duration_minutes || 30) * 60 * 1000;
const dueDate = new Date(now.getTime() + durationMs);
// ثم في insert:
start_time: now.toISOString()
due_date: dueDate.toISOString()
```

### الزرار -- التعديل
```text
// سطر 1289-1298: إضافة شرط disabled + Tooltip
const isActive = isSessionActiveCairo(session.session_date, session.session_time, group?.duration_minutes);

<Tooltip> wrapper لو !isActive
<Button disabled={!isActive || assigningCurriculumQuiz} ...>
```

---

## الملفات المتأثرة

| الملف | التغيير |
|-------|---------|
| `src/lib/sessionTimeGuard.ts` | إضافة `isSessionActiveCairo()` + helper `buildSessionStartParts()` |
| `src/pages/SessionDetails.tsx` | guard في `handleAssignCurriculumQuiz` + تغيير `start_time` + تعطيل الزرار |

## ما لن يتغير
- منطق `isSessionEndedCairo` (موجود ومستخدم لأغراض تانية)
- تجربة الطالب في حل الكويز
- مدة الكويز (الطالب ياخد مدته كاملة دائما)

