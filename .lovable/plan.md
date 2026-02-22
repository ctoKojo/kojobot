

# Student ID Card - كارت الطالب PNG

---

## الملخص

اضافة زر "Download ID Card" داخل CredentialsDialog لتوليد كارت طالب كصورة PNG عبر Canvas API بدون اي dependency جديدة. الكارت يظهر فقط عند وجود الباسورد (انشاء طالب او اعادة تعيين).

---

## الملفات (4 ملفات: 1 جديد + 3 تعديل)

| # | الملف | التغيير |
|---|---|---|
| 1 | `src/lib/generateIdCard.ts` | **جديد** - Canvas API لتوليد PNG |
| 2 | `src/components/CredentialsDialog.tsx` | props جديدة + زر Download |
| 3 | `src/pages/Students.tsx` | تمرير avatarUrl و levelName |
| 4 | `src/components/ResetPasswordButton.tsx` | تمرير avatarUrl و levelName |

---

## التفاصيل التقنية

### 1. `src/lib/generateIdCard.ts` (ملف جديد)

دالة واحدة exported:

```text
export async function generateStudentIdCard(options: {
  name: string;
  email: string;
  password: string;
  avatarUrl?: string | null;
  levelName?: string;
}): Promise<void>
```

**التنفيذ خطوة بخطوة:**

1. انشاء canvas 1400x800
2. رسم rounded rect path كامل (radius ~24px) ثم `ctx.clip()` -- كل الرسم بعد الـ clip
3. رسم linear gradient خلفية (`#7BB8D4` -> `#8B7BE8` من اليسار لليمين)
4. تحميل لوجو `/kojobot-logo-white.png` عبر `new Image()` (same-origin، بدون CORS) -- رسمه top-left مع padding
5. لو `levelName` موجود: رسم دائرة top-right بـ border ابيض شفاف (`rgba(255,255,255,0.3)`) + نص الليفل ابيض بالنص
6. تحميل avatar من `avatarUrl` عبر `new Image()` مع `crossOrigin = 'anonymous'` (الـ bucket عام فمفيش مشكلة CORS):
   - نجاح: رسم الصورة في مربع rounded (clipping path دائري) يسار الكارت
   - فشل / مفيش url: رسم مربع rounded بخلفية `rgba(255,255,255,0.15)` + حرف اول من الاسم كبير ابيض bold
7. كتابة النصوص يمين الافاتار:
   - الاسم: خط كبير bold ابيض (48px)
   - "Email:" + القيمة (28px)
   - "Password:" + القيمة (28px)
   - خط system stack: `'Inter', 'Segoe UI', system-ui, sans-serif`
8. تحويل: `canvas.toBlob(blob => ...)` بصيغة `image/png`
9. تنزيل: `URL.createObjectURL(blob)` -> `<a>` مخفي مع `download` = اسم منظف (replace `/\\:*?"<>|` بـ `_`) -> click -> `URL.revokeObjectURL`

**ملاحظات امان:**
- تحميل الصور ملفوف في Promise مع timeout 5 ثواني -- لو فشل يكمل بـ fallback
- لو `password` فاضي الدالة ترجع فورا بدون توليد
- الاسم يتعمله sanitize قبل استخدامه في اسم الملف

### 2. `src/components/CredentialsDialog.tsx`

**تعديل الـ interface (سطر 17-23):**

```text
interface CredentialsDialogProps {
  open: boolean;
  onClose: () => void;
  email: string;
  password: string;
  userName: string;
  avatarUrl?: string | null;    // جديد
  levelName?: string;           // جديد
}
```

**اضافة state:**

```text
const [downloading, setDownloading] = useState(false);
```

**اضافة handler:**

```text
const handleDownloadCard = async () => {
  if (!password || downloading) return;
  setDownloading(true);
  try {
    await generateStudentIdCard({
      name: userName, email, password, avatarUrl, levelName
    });
  } finally {
    setDownloading(false);
  }
};
```

**اضافة زر في DialogFooter (بجانب Copy All):**

زر "Download ID Card" مع ايقونة `Download` من lucide-react. لو `downloading` يعرض spinner. الزر يظهر فقط لو `password` موجود.

### 3. `src/pages/Students.tsx`

**تعديل state (سطر 161):**

```text
const [credentialsDialog, setCredentialsDialog] = useState<{
  open: boolean; email: string; password: string; name: string;
  avatarUrl?: string | null; levelName?: string;
}>({ open: false, email: '', password: '', name: '' });
```

**تعديل setCredentialsDialog عند الانشاء (سطر 412-418):**

بعد رفع الافاتار (سطر 362-366) الـ `avatarUrl` متاح. والـ `levelName` من `levels.find`:

```text
// بعد سطر 366:
const levelName = levels.find(l => l.id === formData.level_id)?.name;
const createdAvatarUrl = avatarFile && data?.user_id
  ? (await uploadAvatar(data.user_id)) // هو اصلا بيتعمل upload فوق
  : null;

setCredentialsDialog({
  open: true,
  email: formData.email,
  password: formData.password,
  name: formData.full_name,
  avatarUrl: createdAvatarUrl || null,  // الـ url اللي اتعمله upload
  levelName,
});
```

ملاحظة: الـ avatar upload بيحصل فعلا في سطر 362 ونتيجته بتتحفظ في profiles. هنحتاج نخزن الـ url المرجع من `uploadAvatar` في متغير ونمرره.

**تعديل CredentialsDialog JSX (سطر 1298-1310):**

```text
<CredentialsDialog
  open={credentialsDialog.open}
  onClose={...}
  email={credentialsDialog.email}
  password={credentialsDialog.password}
  userName={credentialsDialog.name}
  avatarUrl={credentialsDialog.avatarUrl}
  levelName={credentialsDialog.levelName}
/>
```

**تعديل onClose (سطر 1300-1306):**

```text
onClose={() => {
  setCredentialsDialog({ open: false, email: '', password: '', name: '', avatarUrl: null, levelName: undefined });
  ...
}}
```

### 4. `src/components/ResetPasswordButton.tsx`

**تعديل interface (سطر 12-16):**

```text
interface ResetPasswordButtonProps {
  userId: string;
  userName: string;
  userEmail: string;
  avatarUrl?: string | null;    // جديد
  levelName?: string;           // جديد
}
```

**تعديل destructuring (سطر 18):**

```text
export function ResetPasswordButton({ userId, userName, userEmail, avatarUrl, levelName }: ResetPasswordButtonProps)
```

**تمرير للـ CredentialsDialog (سطر 122-128):**

```text
<CredentialsDialog
  open={showCredentials}
  onClose={() => setShowCredentials(false)}
  email={userEmail}
  password={savedPassword}
  userName={userName}
  avatarUrl={avatarUrl}
  levelName={levelName}
/>
```

**تحديث الاستدعاء في StudentProfile.tsx (سطر 288-292):**

```text
<ResetPasswordButton
  userId={studentId!}
  userName={data?.profile?.full_name || ''}
  userEmail={data?.profile?.email || ''}
  avatarUrl={data?.profile?.avatar_url}
  levelName={data?.profile?.levels?.name}
/>
```

---

## Layout الكارت (1400x800)

```text
padding = 40px كل الجوانب

+----------------------------------------------------------+
|  [Logo 180x50]                          ( Level r=40 )   |  y=40
|                                                          |
|   +-----------+                                          |
|   |           |  y=180                                   |
|   |  Avatar   |     Student Full Name  (48px bold)       |  y=260
|   |  200x200  |                                          |
|   |  rounded  |     Email: student@email.com (28px)      |  y=340
|   |           |                                          |
|   +-----------+     Password: Abc123xyz (28px)           |  y=400
|                                                          |
|                     Kojobot Academy  (20px, شفاف)        |  y=720
+----------------------------------------------------------+
```

---

## معايير القبول

- زر "Download ID Card" يظهر في CredentialsDialog فقط لو password موجود
- downloading state يمنع double click
- الكارت PNG بجودة عالية 1400x800
- gradient ازرق-بنفسجي مع rounded corners (clip path)
- لوجو Kojobot top-left من `/kojobot-logo-white.png` (same-origin)
- باج الليفل top-right (لو متاح)
- صورة الطالب rounded (لو متاحة) او fallback حرف اول
- الاسم والايميل والباسورد بخط ابيض واضح
- تنزيل عبر `toBlob` + `createObjectURL` + `revokeObjectURL`
- اسم الملف منظف من الرموز
- متاح للادمن والريسيبشن فقط (CredentialsDialog يظهر فقط في flows الادمن/الريسيبشن)
- بدون اي dependency جديدة

