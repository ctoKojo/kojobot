

## خطة: توحيد صفحة تسجيل الدخول

### الفكرة
دمج `/auth` و `/parent-login` في صفحة واحدة `/auth` تعرض 3 خيارات للمستخدم قبل تسجيل الدخول:
- **طالب** (Student) → إيميل + باسورد
- **موظف** (Staff) → إيميل + باسورد  
- **ولي أمر** (Parent) → Google OAuth

### التغييرات المطلوبة

**1. تعديل `src/pages/Auth.tsx`**
- إضافة state للاختيار: `userType: 'student' | 'staff' | 'parent' | null`
- عرض 3 كروت اختيار (بأيقونات مميزة) كخطوة أولى
- عند اختيار "طالب" أو "موظف" → عرض فورم الإيميل والباسورد الحالي
- عند اختيار "ولي أمر" → عرض زر Google Sign-in (نفس منطق ParentLogin)
- زر "رجوع" للعودة للاختيار
- بعد تسجيل دخول ولي أمر بنجاح → redirect لـ `/parent-register` (نفس السلوك الحالي)

**2. تعديل `src/components/landing/LandingNavbar.tsx`**
- تحديث رابط تسجيل الدخول ليشير لـ `/auth` فقط

**3. تعديل `src/App.tsx`**
- إبقاء route `/parent-login` يعمل redirect لـ `/auth` (backward compatibility)

**4. تعديل `src/pages/Index.tsx`**
- تحديث أي روابط تشير لـ `/parent-login` لتشير لـ `/auth`

### التفاصيل التقنية
- الكروت الثلاثة تكون بنفس تصميم الصفحة الحالية (glass effect، gradient background)
- استخدام `lovable.auth.signInWithOAuth('google')` لولي الأمر
- ال redirect logic بعد الدخول: ولي أمر بدون role → `/parent-register`، باقي المستخدمين → `/dashboard`
- دعم RTL/LTR كامل

