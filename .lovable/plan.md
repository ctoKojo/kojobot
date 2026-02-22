

# Live Session Status Indicator -- حالة السيشن لحظياً

## الهدف
عرض حالة السيشن الحية في صفحة `SessionDetails`:
- **لسه مبدأتش** (قبل وقت البداية)
- **شغالة بقالها X دقيقة** (أثناء السيشن) -- بيتحدث كل دقيقة
- **انتهت** (بعد انتهاء المدة)

---

## التغييرات

### ملف واحد فقط: `src/pages/SessionDetails.tsx`

### 1. إضافة حساب الحالة الحية

- استخدام `useState` + `useEffect` مع `setInterval` كل 60 ثانية لتحديث الحالة
- الحالة بتتحسب باستخدام الدوال الموجودة بالفعل:
  - `isSessionActiveCairo(session_date, session_time, duration_minutes)` -- شغالة؟
  - `isSessionEndedCairo(session_date, session_time, duration_minutes)` -- خلصت؟
  - لو الاتنين `false` -- لسه مبدأتش
- حساب الدقايق المنقضية: الفرق بين Cairo now ووقت بداية السيشن (بالدقايق)

### 2. تعديل منطقة الـ Badge الحالية (سطر 1172-1174)

بدل الـ Badge الحالي اللي بيعرض `completed`/`scheduled` من الداتابيز، هيتضاف **بجانبه** badge حي:

**الحالات الثلاثة:**

| الحالة | اللون | النص (EN) | النص (AR) |
|--------|-------|-----------|-----------|
| لسه مبدأتش | رمادي/amber | Not Started Yet | لسه مبدأتش |
| شغالة | أخضر نابض (animate-pulse) | Live - 25 min elapsed | شغالة - 25 دقيقة |
| انتهت | رمادي | Session Ended | انتهت |

- لو السيشن `completed` في الداتابيز، الـ badge الأصلي يفضل كما هو
- الـ live badge يظهر بجانبه كمعلومة إضافية
- حالة "شغالة" فيها دائرة خضرا صغيرة بـ `animate-pulse` عشان تبين إنها لايف

### 3. مكان العرض

داخل Session Info Card، بجانب الـ Badge الحالي (سطر 1162-1175):
```text
[Completed Badge]  [Live: شغالة - 25 دقيقة]
```

---

## التفاصيل التقنية

### حساب الدقايق المنقضية
- يستخدم نفس `getCairoNowParts` الموجود في `sessionTimeGuard.ts` (محتاج export)
- أو بديل أبسط: حساب الفرق بالدقايق عبر `Intl.DateTimeFormat` مباشرة في الـ component
- الأبسط: parse session start كـ timestamp، طرح من `Date.now()`، قسمة على 60000

### الـ interval
- `useEffect` بـ `setInterval(60_000)` -- تحديث كل دقيقة
- cleanup عند unmount
- أول تشغيل فوري (بدون انتظار الدقيقة الأولى)

### الملفات المتأثرة

| الملف | التغيير |
|-------|---------|
| `src/pages/SessionDetails.tsx` | إضافة live status state + interval + badge في Session Info Card |

### ما لن يتغير
- الـ Badge الأصلي (completed/scheduled) يفضل كما هو
- لا تغيير في `sessionTimeGuard.ts` (الدوال الموجودة كافية)
- لا تغيير في أي ملف تاني

