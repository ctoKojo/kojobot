

# تحديث سلوك Kojo: تقدم إجباري + إزالة حشو ناعمة + كشف تكرار أذكى

## ملخص التغييرات

ملف واحد فقط: `supabase/functions/chat-with-kojo/index.ts` -- بدون تغييرات داتابيز أو فرونت إند.

---

## التغيير 1: تحديث SYSTEM_PROMPT (سطر 46-109)

إضافة 3 قواعد جديدة قبل مثال بايثون (قبل سطر 103):

```text
قاعدة التقدم الاجباري:
- لو الطالب اجاب اجابتين صح متتاليتين على نفس الهدف الحالي انتقل فورا للتطبيق النهائي بمثال كود صغير 3 الى 6 سطور ولا تسال اسئله اضافيه عن نفس الهدف

قاعدة منع الرجوع:
- لو الطالب جاوب صح على سؤال ممنوع ترجع لنفس السؤال او نفس الهدف مرة اخرى في نفس المحادثة

قاعدة تقليل الحشو:
- ممنوع استخدام عبارات حشو مثل "مفيش مشكلة خالص" او "ده سؤال كويس"
- ابدأ الرد بتقييم اجابة الطالب ثم ادخل في الخطوه التاليه مباشرة
```

---

## التغيير 2: إضافة FILLER_PHRASES وإزالة ناعمة في enforceResponse (سطر 220-283)

### ثابت جديد (بعد EXAMPLE_KEYWORDS سطر 44):

```typescript
const FILLER_PHRASES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /مفيش مشكلة خالص/g, replacement: "تمام" },
  { pattern: /ده سؤال كويس/g, replacement: "" },
  { pattern: /سؤال ممتاز/g, replacement: "" },
  { pattern: /أحسنت على السؤال/g, replacement: "" },
];
```

### خطوة جديدة في enforceResponse (بعد harsh tone check، قبل multiple questions trimming):

```typescript
// Filler soft replacement
for (const { pattern, replacement } of FILLER_PHRASES) {
  if (pattern.test(enforced)) {
    qualityFlags.push("filler_removed");
    enforced = enforced.replace(pattern, replacement);
  }
}
// Clean up double spaces/newlines from removals
enforced = enforced.replace(/  +/g, " ").replace(/\n{3,}/g, "\n\n").trim();
```

الفرق عن الحذف الأعمى: "مفيش مشكلة خالص" تتحول لـ "تمام" (استبدال مش حذف)، والعبارات اللي مالهاش بديل مفيد تتشال بس مع تنظيف المسافات.

---

## التغيير 3: كشف تكرار أذكى في extractLastQuestion (سطر 194-203)

### المشكلة الحالية:
`extractLastQuestion` بيدور على `؟` بس. Kojo أحياناً بيسأل من غير علامة استفهام.

### الحل:
توسيع الدالة لتدور كمان على جمل تبدأ بكلمات استفهام عربية:

```typescript
const INTERROGATIVE_STARTS = /^(ايه|إيه|ازاي|إزاي|ليه|امتى|إمتى|فين|مين|هل|كام)/;

function extractLastQuestion(text: string): string | null {
  const lines = text.split("\n").reverse();
  // First pass: explicit ؟
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.endsWith("؟") && trimmed.length > 5) return trimmed;
  }
  // Second pass: interrogative starts
  for (const line of lines) {
    const trimmed = line.trim();
    if (INTERROGATIVE_STARTS.test(trimmed) && trimmed.length > 5) return trimmed;
  }
  return null;
}
```

### توسيع فحص التكرار ضد آخر 3 أسئلة من الهيستوري (سطر 676-678):

بدل مقارنة `newQuestion` مع `lastKojoQuestion` فقط، نقارن كمان مع آخر 2-3 أسئلة من رسائل Kojo في الهيستوري:

```typescript
// Check against last 3 Kojo questions from history
const recentKojoQuestions: string[] = [];
if (lastKojoQuestion) recentKojoQuestions.push(lastKojoQuestion);
for (const msg of [...historyMessages].reverse()) {
  if (msg.role === "assistant" && recentKojoQuestions.length < 3) {
    const q = extractLastQuestion(msg.content);
    if (q && !recentKojoQuestions.includes(q)) recentKojoQuestions.push(q);
  }
}

const isDuplicate = newQuestion && recentKojoQuestions.some(q => isSimilarQuestion(newQuestion, q));
```

---

## ملخص الملفات

| الملف | التغيير |
|-------|---------|
| `supabase/functions/chat-with-kojo/index.ts` | تحديث SYSTEM_PROMPT + إضافة FILLER_PHRASES + توسيع extractLastQuestion + فحص تكرار ضد 3 أسئلة |

بدون migration، بدون فرونت إند. Auto-deploy بعد الحفظ.

