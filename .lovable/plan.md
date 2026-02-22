
# منع اكتمال السيشن قبل معادها - Cairo Parts-Based Guard

---

## الملخص

انشاء دالة `isSessionEndedCairo` في ملف جديد تعتمد على Intl.DateTimeFormat parts بالكامل، بدون new Date في قرار الاكتمال وبدون luxon في الفرونت. تطبيقها على 3 اماكن + تحديث callsite واحد.

---

## الملفات (5 ملفات: 1 جديد + 4 تعديل)

| # | الملف | التغيير |
|---|---|---|
| 1 | `src/lib/sessionTimeGuard.ts` | **جديد** - الدالة المشتركة وكل الـ helpers |
| 2 | `src/pages/Sessions.tsx` | guard في `handleMarkComplete` (سطر 269) |
| 3 | `src/components/group/EditSessionDialog.tsx` | prop `durationMinutes` + disable completed + useEffect safety + رسالة توضيح |
| 4 | `src/pages/SessionDetails.tsx` | استبدال `new Date()` (سطر 224-226) بـ guard في auto-check |
| 5 | `src/pages/GroupDetails.tsx` | تمرير `durationMinutes` للـ EditSessionDialog (سطر 790) |

---

## التفاصيل التقنية

### 1. `src/lib/sessionTimeGuard.ts` (ملف جديد)

**الهيكل:**

- **`cairoFormatter`** - module-scope `Intl.DateTimeFormat` مع `Africa/Cairo` و `hourCycle: h23` (يتنشئ مرة واحدة)
- **`getCairoNowParts()`** - `formatToParts(new Date())` مع تجاهل `literal` parts، يرجع `{ year, month, day, hour, minute, second }` كأرقام
- **`isLeapYear(year)`** - `(year % 4 === 0 && year % 100 !== 0) || year % 400 === 0`
- **`daysInMonth(year, month)`** - يدعم 28/29/30/31 مع السنة الكبيسة
- **`addDaysToDate(year, month, day, daysToAdd)`** - loop يدعم اي عدد ايام (مش بس 0 او 1)، يعبر حدود الشهور والسنين
- **`buildSessionEndParts(sessionDate, sessionTime, durationMinutes)`**:
  - parse sessionDate: `split("-")` -> 3 ارقام، لو اي واحد NaN يرجع `null`
  - parse sessionTime: `split(":")` -> لو `HH:MM` يكمل `:00`، لو فيه NaN يرجع `null`
  - durationMinutes: لو `null` او `undefined` او `<= 0` يستخدم `120`
  - carry: `minute += duration` ثم `second->minute->hour->daysToAdd` ثم `addDaysToDate`
  - يرجع `{ year, month, day, hour, minute, second }`
- **`compareParts(a, b)`** - مقارنة بالارقام مش strings: year ثم month ثم day ثم hour ثم minute ثم second. اول فرق يحدد النتيجة
- **`isSessionEndedCairo(sessionDate, sessionTime, durationMinutes?)`** - الدالة العامة:
  - guard: لو `!sessionDate` او `!sessionTime` يرجع `false`
  - لو `buildSessionEndParts` رجع `null` يرجع `false`
  - `return compareParts(getCairoNowParts(), end) >= 0`

**مثال عبور نهاية الشهر:**
سيشن `2025-01-31` الساعة `23:30` ومدته `90` دقيقة:
- `minute = 30 + 90 = 120` -> carry: `hour += 2, minute = 0` -> `hour = 25` -> carry: `daysToAdd = 1, hour = 1`
- `addDaysToDate(2025, 1, 31, 1)` -> `day = 32 > 31` -> `day = 1, month = 2`
- النتيجة: `2025-02-01 01:00:00`

### 2. `src/pages/Sessions.tsx`

في `handleMarkComplete` (سطر 269) - قبل اي mutation:

```text
import { isSessionEndedCairo } from '@/lib/sessionTimeGuard';

// سطر 270 (قبل الـ supabase update):
if (!isSessionEndedCairo(session.session_date, session.session_time, session.duration_minutes)) {
  toast({
    variant: 'destructive',
    title: isRTL ? 'السيشن لسه ما خلصتش' : "Session hasn't ended yet",
    description: isRTL
      ? 'لا يمكن اكتمال السيشن قبل انتهاء وقتها بتوقيت القاهرة'
      : 'Cannot complete session before its end time (Cairo)',
  });
  return;
}
```

الـ interface `Session` (سطر 54) فيها `duration_minutes: number` جاهزة.

### 3. `src/components/group/EditSessionDialog.tsx`

- اضافة `durationMinutes?: number` في interface (سطر 38)
- import `isSessionEndedCairo` و `useEffect`
- حساب reactive يعتمد على قيم الفورم الحالية:
  ```text
  const isEnded = isSessionEndedCairo(sessionDate, sessionTime, durationMinutes);
  ```
- `useEffect`: لو `status === 'completed' && !isEnded` يرجع `setStatus('scheduled')`
- خيار completed (سطر 175): `disabled={!isEnded}`
- رسالة توضيح تحت الـ Select لو `!isEnded`:
  - عربي: "لا يمكن اكتمال السيشن قبل انتهاء وقتها بتوقيت القاهرة"
  - انجليزي: "Cannot mark as completed before session end time (Cairo)"

### 4. `src/pages/SessionDetails.tsx` (سطر 221-256)

استبدال كامل لمنطق المقارنة:

```text
// بدل سطر 224-226 (new Date parsing):
if (!isSessionEndedCairo(session.session_date, session.session_time, session.duration_minutes)) {
  return; // مش منتهية - لا تعمل اي auto-complete
}
// باقي اللوجيك (makeup RPC سطر 230-253 او direct update) بدون تغيير
```

### 5. `src/pages/GroupDetails.tsx` (سطر 790)

الـ sessions في GroupDetails بتيجي من `data.sessions` (type `any[]`) وبتتحمل من `sessions` table اللي فيها `duration_minutes`. التمرير:

```text
<EditSessionDialog
  session={session}
  onUpdated={fetchGroupData}
  durationMinutes={session.duration_minutes}
/>
```

---

## معايير القبول

- Mark Complete لا يعمل قبل نهاية السيشن بتوقيت القاهرة (toast تحذيري)
- completed في EditSessionDialog يكون disabled قبل نهاية السيشن مع توضيح السبب
- تغيير التاريخ/الوقت في الفورم يعيد حساب الحالة تلقائيا (reactive)
- useEffect يرجع status لـ scheduled لو completed اتختار وبعدين الوقت اتغير
- SessionDetails auto-check يعتمد على Cairo مش UTC ولا توقيت الجهاز
- يدعم HH:MM و HH:MM:SS بدون crash
- لا يوجد new Date() في اي قرار اكتمال
- المنع صحيح في نهاية الشهر ونهاية السنة والسنة الكبيسة وسيشنات بتعدي منتصف الليل
- بيانات فاسدة (NaN, null, سالب) ترجع false بدل اكتمال بالغلط
- getCairoNowParts بيتجاهل literal parts فعلا
- compareParts بيقارن ارقام مش strings
