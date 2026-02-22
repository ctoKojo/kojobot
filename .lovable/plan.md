

# تنفيذ بطاقة الطالب بـ Canvas (PNG)

---

## الملفات (4 تعديلات)

| # | الملف | التغيير |
|---|---|---|
| 1 | `src/lib/pdfReports.ts` | حذف `buildCardHTML` (سطر 189-239) واستبدالها بـ `loadImage` + `drawCardToCanvas` + تحويل `generateStudentCard` لـ `async` |
| 2 | `src/components/CredentialsDialog.tsx` | `onClick` يبقى `async` مع `await` |
| 3 | `src/pages/Students.tsx` | `onClick` في الموبايل (سطر 1117) والديسكتوب (سطر 1269) يبقى `async` مع `await` |
| 4 | `src/pages/StudentProfile.tsx` | `onClick` (سطر 298) يبقى `async` مع `await` |

---

## التفاصيل

### 1. `src/lib/pdfReports.ts`

**يتحذف**: `buildCardHTML` (سطر 189-239)

**يتضاف**:

- `loadImage(src, timeout=2000)`: ترجع `Promise<HTMLImageElement | null>` - تحمل الصورة بـ `crossOrigin="anonymous"` مع timeout
- `drawCardToCanvas(student, options)`: ترجع `Promise<string>` (data URL PNG):
  - Canvas بمقاس **1016 x 638** بكسل
  - Clip rounded corners (radius 24px) على كل الرسم
  - خلفية بيضاء
  - Header gradient (اعلى 35%) من `#61BAE2` لـ `#6455F0`
  - Avatar دائري 100px مع `ctx.arc` clip:
    - لو الصورة نجحت: `drawImage`
    - لو فشلت/timeout: دائرة gradient + حرف اول بخط ابيض 44px
  - الاسم: سطر او سطرين (عربي+انجليزي) بخط ابيض 32px/22px
  - "Kojobot" عمودي بـ `ctx.rotate(-PI/2)` على الطرف (يتعكس في RTL)
  - الحقول: كل حقل غير فاضي يترسم بـ label رمادي + value اسود
  - الباسورد: مستطيل `#fff3cd` بـ rounded corners + label وقيمة بلون `#856404`
  - RTL/LTR: `textAlign` و `x` positions يدوي

- `generateStudentCard` يبقى `async`:
  - يستدعي `await drawCardToCanvas(...)` مرة واحدة
  - يفتح `openPrintWindow` بـ `<img>` مكرر مرتين (طالب + ارشيف)
  - الصورة بمقاس `width: 86mm; height: 54mm`
  - `@media print { body { margin: 5mm; } }`

### 2. `src/components/CredentialsDialog.tsx` (سطر 111)

- `onClick` يبقى `async () => { if (!password) return; await generateStudentCard(...) }`

### 3. `src/pages/Students.tsx` (سطر 1117 و 1269)

- الموبايل والديسكتوب: `onClick` يبقى `async` مع `await generateStudentCard(...)`

### 4. `src/pages/StudentProfile.tsx` (سطر 298)

- `onClick` يبقى `async` مع `await generateStudentCard(...)`

---

## معايير القبول

- PNG بمقاس 1016x638px (300 DPI)
- الطباعة ثابتة (صورة مش HTML)
- مقاس 86mm x 54mm في الطباعة
- نسختين (طالب + ارشيف)
- Avatar fallback تلقائي لو CORS/timeout
- حقول فاضية ما تظهرش
- الباسورد فقط لو موجود
- RTL/LTR يدوي بـ textAlign و x
- "Kojobot" عمودي بـ rotate
- Shadow لا يظهر في print
- هوامش print 5mm
- `openPrintWindow` الحالي مستخدم

