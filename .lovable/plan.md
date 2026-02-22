

# دمج لايف سيشن Jitsi Meet داخل الموقع

## ملخص
دمج غرف فيديو Jitsi Meet داخل الموقع للمجموعات الأونلاين، مع حماية الوصول وfallback للروابط الخارجية.

---

## الملفات الجديدة

### 1. `src/pages/LiveSession.tsx`
- صفحة محمية بمسار `/live-session/:groupId`
- تتحقق من عضوية المستخدم في الجروب (طالب في `group_students` / مدرب `groups.instructor_id` / admin)
- لو مش عضو --> redirect لـ `/dashboard` مع toast خطأ
- هيدر فيه اسم الجروب + زر رجوع لصفحة الجروب (`/group/:groupId`)
- Loading state لحد ما Jitsi يجهز
- Fallback button لو `session_link` موجود (يفتح الرابط الخارجي)
- لو Jitsi فشل يحمل --> يعرض الـ fallback تلقائيا

### 2. `src/components/JitsiMeeting.tsx`
- مكون يدمج Jitsi Meet External API
- يحمل السكربت `https://meet.jit.si/external_api.js` ديناميكيا (مرة واحدة)
- ينشئ `JitsiMeetExternalAPI` instance داخل div container
- Room name: `kojobot-{first 12 chars of groupId}` (غير قابل للتخمين لأن groupId هو UUID عشوائي)
- يمرر `userInfo`: displayName, email, avatarUrl من البروفايل
- Config:
  - `startWithAudioMuted: true` للطلاب
  - `startWithVideoMuted: true` للطلاب
  - `prejoinPageEnabled: false`
  - `disableDeepLinking: true`
- Events: `videoConferenceJoined`, `readyToClose`, error handling
- ينضف الـ instance في `useEffect` cleanup (منع memory leak)
- يستقبل `onError` callback للـ fallback
- يستقبل `onClose` callback للرجوع

---

## الملفات المعدلة

### 3. `src/App.tsx`
- إضافة import لـ `LiveSession`
- إضافة Route: `/live-session/:groupId` محمي بـ `ProtectedRoute`

### 4. `src/components/dashboard/StudentDashboard.tsx` (سطر 311-323)
- تغيير زر "Join Session" من رابط خارجي إلى:
  - زر أساسي: `navigate('/live-session/' + groupId)` --> "انضم للسيشن"
  - زر ثانوي (لو `session_link` موجود): يفتح الرابط الخارجي --> "رابط خارجي"

### 5. `src/pages/SessionDetails.tsx` (سطر 1149-1157 و 1181-1188)
- تغيير أزرار "Join Session" في الهيدر وQuick Actions:
  - الزر الأساسي: `navigate('/live-session/' + groupId)`
  - dropdown أو زر إضافي للرابط الخارجي لو موجود

### 6. `src/pages/GroupDetails.tsx` (سطر 380-408)
- تغيير كارت "Session Link":
  - زر أساسي: `navigate('/live-session/' + groupId)` --> "انضم من داخل المنصة"
  - زر ثانوي: يفتح `session_link` خارجيا --> "رابط خارجي"
  - زر النسخ يبقى كما هو

---

## التفاصيل التقنية

### Room Name Security
- الـ `groupId` هو UUID عشوائي (مثلا `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)
- Room name: `kojobot-a1b2c3d4e5f6` (أول 12 حرف بدون شرطات)
- صعب التخمين لأن UUID عشوائي أصلا

### التحقق من العضوية (داخل LiveSession)
```text
1. جلب الجروب بالـ groupId مع instructor_id
2. لو role === 'admin' --> مسموح
3. لو user.id === group.instructor_id --> مسموح
4. لو user.id موجود في group_students (is_active = true) --> مسموح
5. غير ذلك --> ممنوع
```

### Jitsi Config
```text
domain: meet.jit.si
configOverwrite:
  - startWithAudioMuted: true (للطلاب)
  - startWithVideoMuted: true (للطلاب)
  - prejoinPageEnabled: false
  - disableDeepLinking: true
interfaceConfigOverwrite:
  - SHOW_JITSI_WATERMARK: false (محاولة، مش مضمونة على السيرفر العام)
  - SHOW_WATERMARK_FOR_GUESTS: false
```

### Fallback Strategy
```text
1. لو السكربت فشل يحمل --> عرض رسالة خطأ + زر الرابط الخارجي (لو موجود)
2. لو مفيش session_link --> رسالة "تواصل مع الإدارة"
3. Timeout 15 ثانية على تحميل السكربت
```

### لا يحتاج تغييرات في قاعدة البيانات
- كل البيانات المطلوبة موجودة: `groups`, `group_students`, `profiles`

### الترجمة (AR/EN)
- كل النصوص ستكون bilingual كباقي الموقع باستخدام `isRTL` / `language`
