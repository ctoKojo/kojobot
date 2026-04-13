

# إصلاح مشكلة التوجيه الخاطئ لبوابة أولياء الأمور

## المشكلة
Race condition في `AuthContext.tsx`: كل من `onAuthStateChange` و `getSession` بيشتغلوا في نفس الوقت وبيعملوا `fetchUserRole` مرتين. ده بيسبب:

1. `getSession` يخلص ويضبط `role = 'admin'` و `roleLoading = false`
2. `onAuthStateChange` (INITIAL_SESSION) يضرب `roleLoading = true` تاني
3. لحظة قصيرة `role` ممكن يبقى `null` بين الاتنين → redirect لـ `/parent-register`

## الحل

### 1. إعادة كتابة `AuthContext.tsx` — مصدر واحد للحقيقة
- **إزالة** `getSession` call المنفصل بالكامل
- الاعتماد على `onAuthStateChange` فقط (بيبعت `INITIAL_SESSION` event تلقائياً)
- استخدام `useRef` لمنع double-fetch
- ضمان إن `roleLoading` مش بيتضرب `true` مرتين

### 2. تأمين شرط التوجيه في `ProtectedRoute.tsx`
- إضافة شرط إضافي: لو المستخدم سجل عن طريق email/password (مش Google OAuth) → **مش** يتوجه لـ `/parent-register` أبداً
- التحقق من `user.app_metadata.provider` — لو `email` يعني مش parent flow

```text
الشرط الجديد:
if (!role && user.app_metadata?.provider === 'google' && pathname !== '/parent-register') {
  → redirect to /parent-register
}
if (!role && user.app_metadata?.provider !== 'google') {
  → redirect to /dashboard (أو show error)
}
```

## الملفات المتأثرة

| ملف | تعديل |
|-----|--------|
| `src/contexts/AuthContext.tsx` | إزالة getSession المكرر، استخدام onAuthStateChange فقط مع ref guard |
| `src/components/ProtectedRoute.tsx` | تأمين شرط الـ no-role redirect بفحص provider |

## لماذا ده يحل المشكلة
- مصدر واحد لتحميل الـ role → مفيش race condition
- حتى لو الـ role اتأخر، الأدمن (provider = email) مش هيتوجه لصفحة أولياء الأمور أبداً
- أولياء الأمور (provider = google) هيتوجهوا بشكل صحيح

