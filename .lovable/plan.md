

# حل مشكلة التخريف — النسخة المتكاملة

## الوضع الحالي

- `chatbot_conversations` فيه بالفعل: `summary`, `current_step`, `last_kojo_question` — لكن **مش مستخدمين في الكود**
- `MAX_HISTORY = 20` رسالة كاملة بتتبعت كلها → تشبع الكونتكست

## التغييرات المطلوبة

### 1. Migration — إضافة أعمدة State للمحادثة

```sql
ALTER TABLE chatbot_conversations
ADD COLUMN IF NOT EXISTS praise_flags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS concepts_mastered text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS summary_message_count integer DEFAULT 0;
```

- `praise_flags`: مدح اتقال قبل كده (مثلاً `praised_fix_semicolon`)
- `concepts_mastered`: مفاهيم الطالب اتعلمها (مثلاً `if_syntax`, `print_function`)
- `summary_message_count`: عدد الرسايل اللي اتلخصت — عشان التلخيص التراكمي يعرف يبدأ من فين

### 2. تعديل Edge Function — 5 تغييرات رئيسية

**ملف**: `supabase/functions/chat-with-kojo/index.ts`

#### أ. تحديث SYSTEM_PROMPT — إضافة قواعد ضد التكرار

```text
# ممنوع التكرار:
- لو مدحت الطالب على نقطة، متمدحوش عليها تاني أبداً
- لو الطالب جاوب صح، متسألش نفس السؤال — كمّل فوراً
- لو الطالب قال كلمة مفتاحية (زي "print")، اعترف بيها وابني عليها
- كل رد لازم يضيف معلومة جديدة — لو مفيش جديد، لخّص واسأل "عايز نكمل في حاجة تانية؟"
```

وكمان إضافة section بيقرأ الـ state:

```text
# معلومات عن تقدم الطالب (متكررش حاجة من دول):
- مفاهيم اتعلمها: {concepts_mastered}
- مدح اتقال: {praise_flags}
- آخر سؤال اتسأل: {last_kojo_question}
- الهدف الحالي: {current_step}
```

#### ب. تغيير MAX_HISTORY → تلخيص تراكمي

```typescript
const MAX_RECENT = 10;
```

**المنطق الجديد**:
1. جلب `summary` و `summary_message_count` من `chatbot_conversations`
2. جلب كل الرسايل (مش بس آخر 20)
3. لو عدد الرسايل > `summary_message_count + MAX_RECENT`:
   - الشريحة الجديدة = رسايل من `summary_message_count` لحد `total - MAX_RECENT`
   - تلخيص الشريحة الجديدة فقط وإضافتها للـ summary الموجود
   - تحديث `summary` و `summary_message_count` في الـ DB
4. بناء الـ messages للموديل:
   ```
   system prompt (مع state مضمن)
   → summary الحالي (كـ system message)
   → آخر MAX_RECENT رسالة كاملة
   ```

#### ج. Summarization — طلب تلخيص بقيود صارمة

```typescript
const SUMMARY_SYSTEM = `لخّص تقدم الطالب في 2-3 سطور. اكتب حقائق فقط:
- هدف الطالب الحالي
- آخر إجابة صحيحة
- آخر خطأ اتصلح
- مفاهيم اتعلمها
ممنوع: مدح، أسئلة، نصايح، تكرار.`;
```

- استخدام `gemini-2.5-flash-lite` للتلخيص (أسرع وأرخص)
- `temperature: 0.1` عشان التلخيص يكون ثابت ومش عشوائي
- `max_tokens: 200`

#### د. تحديث State بعد كل رد

بعد ما الرد يتبعت وقبل `controller.close()`:

```typescript
// Extract state from assistant response
const stateUpdate = {
  last_kojo_question: extractLastQuestion(fullAssistantContent),
  current_step: extractCurrentGoal(fullAssistantContent),
};

// Update praise_flags and concepts from conversation flow
// (append new ones, don't overwrite)
await db.from("chatbot_conversations")
  .update(stateUpdate)
  .eq("id", conversationId);
```

#### هـ. Post-Check — مراجعة برمجية بعد التوليد

قبل ما نبعت الرد للطالب، فحص بسيط:

```typescript
function postCheckResponse(
  response: string,
  lastTwoAssistantMessages: string[],
  lastKojoQuestion: string | null
): string {
  // 1. لو الرد بيكرر نفس السؤال السابق بالظبط → شيل السؤال
  // 2. لو الرد فيه نفس جملة مدح من آخر ردين → شيلها
  // بيشتغل بـ string matching بسيط مش AI
  return cleanedResponse;
}
```

ده فحص خفيف جداً (string comparison) مش AI call إضافي. بيشيل التكرار الواضح حتى لو الموديل عمله.

### 3. ملخص الـ Flow الجديد

```text
رسالة جديدة من الطالب
    ↓
جلب conversation state (summary, praise_flags, concepts, last_question)
    ↓
جلب كل الرسايل
    ↓
لو فيه رسايل جديدة محتاجة تلخيص:
    → تلخيص تراكمي (flash-lite, temp=0.1)
    → حفظ summary + summary_message_count
    ↓
بناء context:
    system prompt + state → summary → آخر 10 رسايل
    ↓
إرسال للموديل (gpt-5)
    ↓
post-check: شيل تكرار سؤال/مدح
    ↓
stream للطالب + حفظ في DB
    ↓
تحديث state (last_question, current_step, praise_flags, concepts)
```

### 4. ملاحظات

- التلخيص مش هيحصل كل رسالة — بس لما الرسايل تعدي الحد
- الـ post-check خفيف ومش بيأثر على سرعة الـ streaming لأنه بيشتغل على النص الكامل بعد ما يخلص
- ملاحظة: الـ streaming هيفضل شغال عادي — الـ post-check هيكون للحفظ في الـ DB فقط (الطالب هيشوف الرد كامل)
  - بديل: نخلي الـ post-check يشتغل على الـ stream نفسه — لكن ده هيعقد الكود بدون فايدة كبيرة

