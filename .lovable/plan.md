

## خطة: إخفاء شات بوت Kojo عند نفاد رصيد الـ AI

### الفكرة
عند نفاد رصيد AI (أي أن الـ edge function بترجع 402)، نخفي زرار الشات بوت بالكامل بدل ما نعرض رسالة خطأ. الويدجت يظهر تاني لما الرصيد يتجدد.

### التنفيذ

**1. إضافة state للـ AI availability في `KojoChatWidget.tsx`:**
- إضافة `aiAvailable` state (default: `true`)
- عند استلام 402 من الـ edge function → `setAiAvailable(false)`
- فحص دوري (كل 5 دقائق) بـ HEAD request أو رسالة بسيطة للـ edge function للتأكد إن الرصيد رجع
- لو `aiAvailable === false` → الكومبوننت يرجع `null` (مش بيظهر خالص)

**2. التفاصيل التقنية:**
- في `handleSend`، عند 402: بدل التوست، هنعمل `setAiAvailable(false)` + نعرض توست مرة واحدة يوضح إن الخدمة مش متاحة
- نضيف `useEffect` بـ interval كل 5 دقائق يعمل lightweight check (مثلاً OPTIONS أو ping endpoint) — أو ببساطة نعتمد على إعادة فتح الصفحة
- لو `!aiAvailable` → return `null` قبل أي render

### الملفات المتأثرة
- `src/components/KojoChatWidget.tsx` — إضافة logic الإخفاء

