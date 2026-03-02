

# تسريع تحميل PDF المنهج

## المشكلة

البطء ناتج عن سببين:

1. **الـ Edge Function بتعمل 6 استعلامات متتالية** للداتابيز (واحد ورا التاني)، وده بياخد وقت خصوصاً مع الـ cold start
2. **طريقة التحميل في المتصفح** بتستخدم anchor tag مع `download` attribute، لكن الـ `download` attribute مش بيشتغل مع روابط من domain تاني (cross-origin) -- فالمتصفح بيفتح الملف الأول بدل ما يحمله مباشرة

## الحل

### 1. تسريع الـ Edge Function بتشغيل الاستعلامات بالتوازي

بدل 6 استعلامات متتالية، هنعمل:
- **دمج** استعلام الـ session والـ group في استعلام واحد باستخدام join
- **تشغيل بالتوازي** التحقق من صلاحية المستخدم (admin check) مع البحث عن ملف الـ PDF

```text
قبل (متتالي):
  getUser -> sessions -> groups -> curriculum_sessions -> assets -> admin_check -> signedUrl
  = 7 round trips

بعد (متوازي + مدمج):
  getUser -> sessions+groups (join) -> [curriculum_sessions + admin_check بالتوازي] -> assets -> signedUrl
  = ~4-5 round trips
```

### 2. إصلاح التحميل في المتصفح

استخدام `fetch` + `blob` + `URL.createObjectURL` بدل الـ anchor tag عشان نضمن إن الملف يتحمل فعلاً مش يتفتح في تاب جديد. ده هيشتغل صح مع الروابط من domain تاني.

## التغييرات التقنية

### ملف 1: `supabase/functions/get-session-pdf-url/index.ts`
- دمج استعلام sessions و groups في استعلام واحد بـ join
- تشغيل admin role check بالتوازي مع البحث عن curriculum session و assets
- تقليل عدد الـ round trips من 7 لـ 4-5

### ملف 2: `src/pages/MySessions.tsx`
- تغيير طريقة التحميل من anchor tag لـ fetch + blob
- إضافة loading state على الزرار أثناء التحميل

### ملف 3: `src/pages/SessionDetails.tsx`
- نفس تغيير طريقة التحميل (fetch + blob) لو موجود فيها نفس الكود

