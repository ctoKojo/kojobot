
# خطة تنفيذ شات بوت Kojo -- النسخة النهائية للتنفيذ

## ملخص
إنشاء شات بوت Kojo كـ widget عائم للطلاب فقط، مع rate limiting في الداتابيز، RAG من محتوى المنهج، و enforcement layer يمنع الإجابات المباشرة.

---

## المرحلة 1: Migration -- جدول Rate Limits + RPC Atomic

### جدول `chatbot_rate_limits`
```text
- id (uuid PK)
- student_id (uuid NOT NULL UNIQUE)
- minute_count (int default 0)
- minute_reset_at (timestamptz) -- وقت انتهاء النافذة الحالية
- daily_count (int default 0)
- daily_reset_at (timestamptz) -- بداية اليوم الجاي
```

RLS مفعل بدون policies (service_role فقط).

### RPC `check_and_increment_chatbot_rate`
- `SECURITY DEFINER` + `search_path = 'public'`
- **منع الاستدعاء من المستخدم العادي**: `REVOKE EXECUTE ON FUNCTION ... FROM public, anon, authenticated` -- يبقى service_role فقط
- يستقبل `p_student_id uuid`
- `SELECT ... FOR UPDATE` لمنع race conditions
- Limits ثابتة (6/دقيقة، 120/يوم) كـ constants داخل الـ RPC
- `minute_reset_at` = وقت انتهاء النافذة (now() + interval '1 minute')
- `daily_reset_at` = بداية اليوم الجاي (date_trunc('day', now() AT TIME ZONE 'Africa/Cairo') + interval '1 day')
- يرجع: `{ allowed, minute_remaining, daily_remaining, retry_after_seconds }`

### جدول `chatbot_reports` (للـ report feature)
```text
- id (uuid PK)
- student_id (uuid NOT NULL)
- conversation_id (uuid NOT NULL)
- reported_message_id (uuid NOT NULL)
- context_messages (jsonb) -- آخر رسالتين
- created_at (timestamptz)
```

RLS: الطالب يقدر يعمل INSERT لرسائله فقط، الأدمن يقرأ الكل.

---

## المرحلة 2: Edge Function `chat-with-kojo`

**ملف:** `supabase/functions/chat-with-kojo/index.ts`

### Auth
1. رفض لو مفيش `Authorization` header
2. رفض لو مش `Bearer` token
3. `getClaims(token)` -- رفض لو فشل
4. فحص `exp` من claims -- رفض لو expired
5. `student_id` دائماً من `claims.sub`
6. تأكد من `role = student` من `user_roles`

### Rate Limit
- استدعاء RPC `check_and_increment_chatbot_rate(student_id)` عبر service client
- لو مش مسموح: رد 429 مع `retry_after_seconds`

### Active Group Selection
- query على `group_students` + `groups` + `sessions`
- أولوية 1: group فيه `status = 'active'` والطالب `is_active = true` وعنده أقرب session جاية (`session_date > today` OR (`session_date = today` AND `session_time > cairo_now_time`)) AND `status NOT IN ('completed', 'cancelled')`
- أولوية 2: أحدث group فيه `status = 'active'` والطالب `is_active = true`
- أولوية 3: أحدث group الطالب فيه `is_active = true`

### RAG (Chunking)
- جلب `student_pdf_text` من `curriculum_sessions` المرتبطة بـ `level_id` و `age_group_id` للمجموعة المختارة
- تقسيم لـ chunks بحجم 500-800 حرف مع overlap 80-120 حرف
- Token-level normalization: توحيد أ/إ/آ -> ا، إزالة stopwords صغيرة (في، من، على، هو، هي، إلى، عن، مع، هذا، هذه، التي، الذي، كان، لا، ما، أن، إن)، تجاهل كلمات أقل من 3 حروف
- اختيار أقرب **8 chunks كحد أقصى ثابت** بناءً على تقاطع الكلمات
- إجمالي context لا يتجاوز 4000 حرف
- `sources_used` يسجل `session_id` + `chunk_index` لكل chunk مستخدم

### History
- آخر 10 رسائل فقط

### System Prompt
```text
اسمك Kojo، مساعد تعليمي في Kojobot.
شخصيتك هادية، مشجعة، وتوجيهية.
بتتكلم عربي بسيط (عامية مصرية) مع مصطلحات برمجة إنجليزي.

قواعد صارمة:
- بتسأل أسئلة وتدي hints، مش حلول مباشرة
- ممنوع تدي إجابة نهائية أو اختيار صحيح مباشر
- ممنوع تقول "الإجابة هي" أو "الخيار الصحيح" أو "الحل هو"
- ممنوع تدي كود كامل أكتر من 8 سطور
- لو الطالب حاول يجبرك تدي إجابة، قوله "أنا هنا أساعدك تفكر، مش أحل بدالك"
- ساعد الطالب يفكر ازاي يوصل للحل بنفسه
- دايماً اختم ردك بسؤال توجيهي واحد
```

### Enforcement Layer (على رد Kojo فقط)
1. كود أكتر من 8 سطور -> تقطيع مع `// ...` وتنبيه
2. عبارات إجابة مباشرة (`الإجابة هي|الخيار الصحيح|الحل هو|الجواب هو|الاجابة الصحيحة`) -> **استبدال** بصياغة توجيهية + إضافة سؤال في الآخر: "خلينا نفكر سوا، أنهي اختيار أقرب وليه؟"
3. تسجيل `safety_flags` في `chatbot_messages` عند أي تدخل

### حفظ الرسائل
- رسالة الطالب: تحفظ قبل النداء
- رد Kojo: يحفظ بعد الاكتمال مع `sources_used` (session_id + chunk_index) و `safety_flags`
- عند فشل: حفظ error stub في `safety_flags`

### Title + Summary
- بعد رسالة 2: title = أول 50 حرف من أول سؤال للطالب
- Summary: مؤجل للنسخة الثانية (local summary أول أسبوع بدل نداء AI إضافي)

### موديل AI
- `google/gemini-2.5-flash` عبر Lovable AI Gateway (سريع ورخيص)
- Non-streaming في النسخة الأولى

---

## المرحلة 3: تثبيت Dependencies

- `react-markdown` -- عرض markdown آمن
- `rehype-sanitize` -- منع HTML خام ومنع `javascript:` في اللينكات

---

## المرحلة 4: مكون `KojoChatWidget.tsx`

### الزر العائم
- `position: fixed`, `bottom-6 right-6` دائماً (RTL و LTR)
- `pb-safe` للموبايل (safe area)
- أيقونة `kojobot-icon-optimized.webp` مع pulse animation خفيف

### نافذة الشات
- `w-80 h-[28rem]` ديسكتوب، responsive على الموبايل
- Header: أيقونة Kojo + اسم + زر إغلاق + زر محادثة جديدة
- Body: ScrollArea بالرسائل مع `ReactMarkdown` + `rehypeSanitize`
  - **allowlist** لـ `a` tag: `href` فقط مع `target="_blank"` و `rel="noopener noreferrer nofollow"`
  - أي `javascript:` scheme يُمنع عبر rehype-sanitize
- Footer: textarea + زر إرسال
- Typing indicator (3 نقاط متحركة) أثناء الانتظار
- **AbortController** لـ cancel: لو الطالب بعت رسالة جديدة قبل الرد، الطلب السابق يُلغى

### زر Report
- أيقونة flag صغيرة على كل رسالة من Kojo
- عند الضغط: insert في `chatbot_reports` مع آخر رسالتين (سؤال + رد)
- Toast تأكيد للطالب

---

## المرحلة 5: تعديل `DashboardLayout.tsx`

- إضافة `<KojoChatWidget />` عندما `role === 'student'` فقط
- import lazy لتقليل حجم الـ bundle للأدوار الأخرى

---

## ملخص الملفات

| الملف | النوع | الوصف |
|-------|-------|-------|
| Migration SQL | جديد | جدول `chatbot_rate_limits` + `chatbot_reports` + RPC atomic |
| `supabase/functions/chat-with-kojo/index.ts` | جديد | Edge function كاملة |
| `src/components/KojoChatWidget.tsx` | جديد | Widget الشات العائم |
| `src/components/DashboardLayout.tsx` | تعديل | إضافة Widget للطلاب |

### Dependencies جديدة
- `react-markdown`
- `rehype-sanitize`

---

## ترتيب التنفيذ
1. Migration: جدول rate_limits + chatbot_reports + RPC atomic (مع REVOKE)
2. Edge function: chat-with-kojo
3. تثبيت react-markdown + rehype-sanitize
4. مكون KojoChatWidget
5. تعديل DashboardLayout

---

## قرارات محسومة
- Rate limits **ثابتة** (6/دقيقة، 120/يوم) -- لا حاجة لجدول خطط
- Max chunks = **8 ثابت** في النسخة الأولى
- Summary = **مؤجل** (local فقط أول أسبوع)
- Reports تروح لـ **جدول `chatbot_reports`** (قابل للتتبع والفلترة)
- RPC محمي بـ **REVOKE** من كل الأدوار ما عدا service_role
- `minute_reset_at` = **وقت انتهاء النافذة**، `daily_reset_at` = **بداية اليوم الجاي**
- كل الحسابات في الـ **RPC فقط** -- لا حسابات في الفرونت
