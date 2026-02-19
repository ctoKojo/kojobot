

# نظام المنهج الموحد + تحسين السيشنات التعويضية - Production Ready Final

---

## نظرة عامة

تحويل الكيان التعليمي الى **Academic Operating System** مع تطبيق كل التحسينات المقترحة: Curriculum Lock/Publish، Makeup Credits Ledger، Filtered RPC بدل CROSS JOIN، Composite Index للـ latest version، و Signed URL expiry مخصص حسب الدور.

---

## المرحلة 1: قاعدة البيانات

### 1.1 جدول `curriculum_sessions`

```text
curriculum_sessions
  id UUID PK
  age_group_id UUID NOT NULL FK(age_groups)
  level_id UUID NOT NULL FK(levels)
  session_number INTEGER NOT NULL (1-12)
  title TEXT NOT NULL
  title_ar TEXT NOT NULL
  description TEXT
  description_ar TEXT
  slides_url TEXT
  summary_video_url TEXT
  full_video_url TEXT
  quiz_id UUID FK(quizzes)
  assignment_title TEXT
  assignment_title_ar TEXT
  assignment_description TEXT
  assignment_description_ar TEXT
  assignment_attachment_url TEXT
  assignment_attachment_type TEXT
  assignment_max_score INTEGER DEFAULT 100
  version INTEGER DEFAULT 1
  is_published BOOLEAN DEFAULT false
  published_at TIMESTAMPTZ
  is_active BOOLEAN DEFAULT true
  created_at TIMESTAMPTZ DEFAULT now()
  updated_at TIMESTAMPTZ DEFAULT now()
  UNIQUE(age_group_id, level_id, session_number, version)
```

- `is_published` + `published_at`: التعديل بعد النشر يتطلب version جديد (Curriculum Lock)
- Composite Index: `(age_group_id, level_id, is_active, version DESC)` لجلب latest version بسرعة
- Index ثانوي: `(age_group_id, level_id, session_number)` للـ hot path

### 1.2 جدول `content_access_rules`

```text
content_access_rules
  id UUID PK
  subscription_type TEXT NOT NULL
  attendance_mode TEXT NOT NULL
  can_view_slides BOOLEAN DEFAULT true
  can_view_summary_video BOOLEAN DEFAULT false
  can_view_full_video BOOLEAN DEFAULT false
  can_view_assignment BOOLEAN DEFAULT true
  can_view_quiz BOOLEAN DEFAULT true
  effective_from DATE DEFAULT CURRENT_DATE
  is_active BOOLEAN DEFAULT true
  created_at TIMESTAMPTZ DEFAULT now()
  updated_at TIMESTAMPTZ DEFAULT now()
  UNIQUE(subscription_type, attendance_mode)
```

### 1.3 جدول `student_makeup_credits` (Ledger)

```text
student_makeup_credits
  id UUID PK
  student_id UUID NOT NULL
  level_id UUID NOT NULL
  total_free_allowed INTEGER DEFAULT 2
  used_free INTEGER DEFAULT 0
  created_at TIMESTAMPTZ DEFAULT now()
  updated_at TIMESTAMPTZ DEFAULT now()
  UNIQUE(student_id, level_id)
```

- بدل حساب runtime كل مرة، يتم تحديث الرصيد عند كل makeup session جديدة
- يسهل التقارير المالية ويمنع النزاعات

### 1.4 RPC بدل View (اداء افضل)

```text
CREATE FUNCTION get_curriculum_with_access(
  p_age_group_id UUID,
  p_level_id UUID,
  p_session_number INTEGER,
  p_subscription_type TEXT,
  p_attendance_mode TEXT
) RETURNS TABLE(...)
```

- يرجع صف واحد بدل CROSS JOIN الذي ينتج 3000 صف
- استعلام واحد بدل 3 من الفرونت

### 1.5 تعديل `makeup_sessions`

```text
ADD COLUMN makeup_type TEXT DEFAULT 'individual'
ADD COLUMN curriculum_session_id UUID REFERENCES curriculum_sessions(id)
```

### 1.6 تعديل `attendance`

```text
ADD COLUMN compensation_status TEXT DEFAULT NULL
ADD COLUMN makeup_session_id UUID REFERENCES makeup_sessions(id)
```

### 1.7 تعديل `quiz_assignments` و `assignments`

```text
ADD COLUMN curriculum_snapshot JSONB DEFAULT NULL
```

### 1.8 Storage Bucket

- bucket `curriculum` (private)
- Signed URLs: 15 دقيقة للطلاب، 4 ساعات للمدربين/الادمن

### 1.9 RLS Policies

- `curriculum_sessions`: Admin = ALL, Instructor = SELECT, Student = SELECT (عبر group membership)
- `content_access_rules`: Admin = ALL, authenticated = SELECT
- `student_makeup_credits`: Admin = ALL, Student = SELECT own

### 1.10 بيانات افتراضية

6 صفوف في `content_access_rules`:
- kojo_squad (online/offline): slides فقط
- kojo_core (online/offline): slides + summary video
- kojo_x (online/offline): الكل

---

## المرحلة 2: صفحة ادارة المنهج

### انشاء `src/pages/CurriculumManagement.tsx`

1. **فلتر**: الفئة العمرية + الليفل
2. **جدول 12 سيشن** مع ايقونات حالة المحتوى + Version badge + Published badge
3. **Dialog تعديل**: عنوان/وصف (AR/EN)، روابط سلايد، فيديوهات (رفع على bucket private)، اختيار كويز، بيانات واجب
4. **ازرار**:
   - "انشاء منهج فارغ" (12 صف، version=1)
   - "نسخ منهج" لفئة/ليفل اخرى
   - "نسخة جديدة" (version+1، نسخ المحتوى)
   - "نشر" (`is_published=true`, `published_at=now()`) -- بعد النشر لا يمكن التعديل الا بنسخة جديدة
5. **تنبيهات**: سيشن فارغة، منهج غير مكتمل

### Routing + Sidebar

- Route: `/curriculum` مع `ProtectedRoute allowedRoles={['admin']}`
- Sidebar: "المنهج" بايقونة `Library` في `settingsNavItems`

---

## المرحلة 3: ربط المنهج بالسيشنات

### تعديل `src/pages/SessionDetails.tsx`

عند فتح سيشن:
1. جلب محتوى المنهج عبر RPC `get_curriculum_with_access`
2. اذا المنهج غير موجود: تنبيه برتقالي واضح (AlertCircle)

**للمدرب/الادمن**:
- قسم "محتوى المنهج": عنوان + وصف + روابط
- زر "اسناد الكويز المحضر" (بضغطة واحدة + curriculum_snapshot)
- زر "اسناد الواجب المحضر" (due_date = +7 ايام + curriculum_snapshot)
- الازرار الحالية (استيراد يدوي) تبقى كـ fallback
- Signed URLs: 4 ساعات

**للطالب**:
- محتوى حسب صلاحيات الباقة من `content_access_rules`
- Signed URLs: 15 دقيقة

---

## المرحلة 4: صلاحيات المحتوى في الاعدادات

### تعديل `src/pages/Settings.tsx`

قسم جديد "صلاحيات المحتوى التعليمي" (admin فقط):
- جدول 6 صفوف: (Squad/Core/X) x (Online/Offline)
- 3 checkboxes لكل صف (سلايد / فيديو ملخص / فيديو كامل)
- `effective_from` يُملأ تلقائيا عند التعديل
- ملاحظة: "التعديلات تسري على الاشتراكات الجديدة فقط"

---

## المرحلة 5: تحسين السيشنات التعويضية

### 5.1 التمييز: فردي vs جماعي

- `makeup_type = 'individual'`: طالب غاب، يحضر مع مجموعة اخرى او سيشن خاصة
- `makeup_type = 'group_cancellation'`: المجموعة كلها اتلغت، اعادة جدولة جماعية

### 5.2 ربط بالمنهج

- `curriculum_session_id` يتحدد تلقائيا من session_number + level + age_group
- المدرب يشوف محتوى المنهج في صفحة التعويضية

### 5.3 الجدولة الذكية

تعديل `src/pages/MakeupSessions.tsx`:
- اقتراح الانضمام لسيشن موجودة (نفس ليفل + session_number + سعة متاحة)
- شروط: نفس المدرب/ليفل + منع duplication
- للالغاء الجماعي: زر "اعادة جدولة للمجموعة كلها"
- تبويبات: "فردية" و "الغاءات جماعية"

### 5.4 Compensation في الحضور

تعديل `src/pages/Attendance.tsx`:
- عند تسجيل غياب: `compensation_status = 'pending_compensation'`
- عند اكمال تعويضية: `compensation_status = 'compensated'` + `makeup_session_id`

### 5.5 Credits Ledger

- عند انشاء makeup: تحديث `student_makeup_credits.used_free += 1` (فقط اذا الغياب بدون عذر)
- غياب بعذر (excused) والغاء جماعي: لا يستهلك الرصيد

### 5.6 تعديل `src/pages/Sessions.tsx`

- عند الغاء سيشن: تمرير `makeup_type = 'group_cancellation'` + `curriculum_session_id`

---

## المرحلة 6: تتبع التقدم

### تعديل `src/pages/StudentProfile.tsx`

- قسم "السيشنات التعويضية":
  - رصيد مجاني متبقي (من `student_makeup_credits`)
  - سيشنات معوضة vs مفقودة
  - جدول تقدم الليفل (1-12): حضر / غاب / عوض

### تعديل `src/components/dashboard/StudentDashboard.tsx`

- قسم المنهج: الليفل الحالي + التقدم (X/12)
- السيشنات التعويضية المجدولة مع badge "تعويضية"

---

## ملخص الملفات المتأثرة

| الملف | نوع التعديل |
|---|---|
| `supabase/migrations/...` | جديد: جداول + اعمدة + RPC + indexes + RLS + bucket + بيانات |
| `src/pages/CurriculumManagement.tsx` | **جديد** |
| `src/pages/SessionDetails.tsx` | تعديل: محتوى المنهج + ازرار اسناد + عرض طالب |
| `src/pages/Settings.tsx` | تعديل: قسم صلاحيات المحتوى |
| `src/pages/MakeupSessions.tsx` | تعديل: makeup_type + جدولة ذكية + تبويبات |
| `src/pages/Sessions.tsx` | تعديل: group_cancellation عند الالغاء |
| `src/pages/Attendance.tsx` | تعديل: compensation_status + curriculum link |
| `src/pages/StudentProfile.tsx` | تعديل: قسم تعويضية + تقدم ليفل |
| `src/components/dashboard/StudentDashboard.tsx` | تعديل: منهج + تعويضية |
| `src/components/AppSidebar.tsx` | تعديل: رابط المنهج |
| `src/App.tsx` | تعديل: route `/curriculum` |

---

## القرارات المعمارية النهائية

| القرار | السبب |
|---|---|
| `is_published` + `published_at` (Curriculum Lock) | يمنع تعديل منهج منشور بالخطأ |
| `version` + Composite Index | جلب latest version بسرعة + حماية الدفعات |
| `curriculum_snapshot` JSONB | حماية قانونية من التعديل بأثر رجعي |
| RPC بدل CROSS JOIN View | اداء: صف واحد بدل 3000 |
| `student_makeup_credits` Ledger | اداء + تقارير مالية + منع نزاعات |
| `effective_from` في access rules | حماية المشتركين الحاليين |
| Signed URLs مختلفة حسب الدور | 15 دقيقة للطلاب، 4 ساعات للمدربين |
| `makeup_type` فردي/جماعي | سلوك تشغيلي مختلف لكل نوع |
| `compensation_status` في attendance | يمنع تناقض غائب + حضر تعويضية |
| Bucket private للمحتوى المدفوع | حماية من الوصول بالرابط المباشر |

