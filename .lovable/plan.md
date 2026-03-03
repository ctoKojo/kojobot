

# خطة SEO النهائية - كوجوبوت (مُحدّثة بالملاحظات)

تم تعديل الخطة بناءً على كل ملاحظاتك. كل نقطة اتظبطت.

---

## 1. مسارات `/ar` و `/en` بمحتوى كامل بلغة واحدة

**الملفات:** `src/App.tsx` + `src/pages/Index.tsx`

- اضافة routes: `/ar` و `/en`
- `/` يعمل redirect لـ `/ar` (أو حسب اللغة المحفوظة)
- Index.tsx يستقبل prop `lang` من الـ route
- صفحة `/ar`: كل النصوص عربي خالص (title, description, headings, paragraphs, FAQ, بيانات المسارات)
- صفحة `/en`: كل النصوص انجليزي خالص
- مفيش خلط لغات في نفس الصفحة
- `document.documentElement.lang` و `dir` يتضبطوا حسب المسار

---

## 2. Canonical + Hreflang ديناميكي لكل نسخة

**الملف:** `src/pages/Index.tsx`

- بدل ما نحط canonical ثابت في index.html (هيفضل واحد غلط)، نحقنه بـ JS حسب المسار:
  - `/ar` → `<link rel="canonical" href="https://kojobot.lovable.app/ar" />`
  - `/en` → `<link rel="canonical" href="https://kojobot.lovable.app/en" />`
- نحقن hreflang tags ديناميكيا كمان:

```text
<link rel="alternate" hreflang="ar" href="https://kojobot.lovable.app/ar" />
<link rel="alternate" hreflang="en" href="https://kojobot.lovable.app/en" />
<link rel="alternate" hreflang="x-default" href="https://kojobot.lovable.app/en" />
```

- useEffect يضيف/يحدث الـ tags في `<head>` عند mount ويشيلها عند unmount

---

## 3. Title و Description منفصلين لكل نسخة

**الملف:** `src/pages/Index.tsx`

- `/ar`:
  - Title: `كوجوبوت اكاديمي - تعليم البرمجة للأطفال من 6 لـ 18 سنة`
  - Description: `اكاديمية كوجوبوت لتعليم البرمجة والتكنولوجيا للأطفال من 6 لـ 18 سنة - اونلاين واوفلاين في المنصورة`

- `/en`:
  - Title: `Kojobot Academy - Coding & Technology for Kids Aged 6-18`
  - Description: `Kojobot Academy teaches coding and technology to kids aged 6-18 - online and offline in Mansoura, Egypt`

- بدون meta keywords

**الملف:** `index.html`

- Title الافتراضي يفضل عام: `Kojobot Academy | كوجوبوت اكاديمي`
- Description الافتراضي يفضل عام كـ fallback
- OG tags تتحدث ديناميكيا من Index.tsx

---

## 4. Sitemap صفحات تسويقية فقط

**ملف جديد:** `public/sitemap.xml`

```text
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://kojobot.lovable.app/ar</loc>
    <xhtml:link rel="alternate" hreflang="ar" href="https://kojobot.lovable.app/ar"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://kojobot.lovable.app/en"/>
    <lastmod>2026-03-03</lastmod>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://kojobot.lovable.app/en</loc>
    <xhtml:link rel="alternate" hreflang="ar" href="https://kojobot.lovable.app/ar"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://kojobot.lovable.app/en"/>
    <lastmod>2026-03-03</lastmod>
    <priority>1.0</priority>
  </url>
</urlset>
```

- بدون `/auth` او اي صفحات داخلية
- روابط absolute كاملة

---

## 5. تحديث robots.txt

**الملف:** `public/robots.txt`

```text
User-agent: *
Allow: /

Sitemap: https://kojobot.lovable.app/sitemap.xml
```

---

## 6. JSON-LD Structured Data

**الملف:** `src/pages/Index.tsx`

- `EducationalOrganization`: اسم + وصف مطابق للمحتوى الظاهر فعلا حسب اللغة
- `FAQPage`: من faqData الموجود - عربي خالص في `/ar`، انجليزي خالص في `/en`
- `Course`: مسار Software + Hardware - مطابق للكروت الظاهرة

---

## 7. Semantic HTML

**الملف:** `src/pages/Index.tsx`

- `nav` للنافبار
- `main` للمحتوى
- `section` لكل قسم (hero, features, tracks, plans, FAQ, contact)
- `footer` للفوتر
- `h1` واحد فقط (اسم كوجوبوت في الهيرو)
- باقي العناوين `h2` و `h3` بترتيب صحيح

---

## ترتيب التنفيذ

1. اضافة `/ar` و `/en` routes في App.tsx + تعديل Index.tsx ليستقبل اللغة من URL
2. ضبط محتوى كل نسخة بلغة واحدة خالصة
3. حقن canonical + hreflang + title + description ديناميكيا حسب المسار
4. انشاء sitemap.xml + تحديث robots.txt
5. اضافة JSON-LD
6. تحويل لـ semantic HTML

---

## ملاحظة عن SPA

- التعديلات دي هتشتغل مع Google JavaScript rendering
- لكن لازم تتابع في Search Console بعد النشر وتعمل URL Inspection لكل نسخة
- لو ظهرت مشاكل في الفهرسة، الحل الأمثل هيكون SSR وده خارج نطاق Lovable حاليا

