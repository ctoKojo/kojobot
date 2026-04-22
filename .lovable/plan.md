

# تحسين شامل لصفحة التذكيرات الجماعية

## الوضع الحالي والمشاكل

صفحة `/bulk-reminders` دلوقتي محدودة جداً:
- **نوعين تذكير بس**: قسط مستحق + تذكير حصة (مع إن النظام عنده 24 حدث إيميل في الكاتالوج)
- **محتوى ثابت**: نص الرسالة مكتوب جوه القالب، مفيش تخصيص للموضوع أو نص الإيميل
- **فلترة ضعيفة**: بحث نصي بس، مفيش فلتر حسب المجموعة أو المستوى أو حالة الاشتراك
- **مستلم واحد بس**: ولي الأمر فقط — لو مفيش ولي أمر، الطالب يتم تخطيه
- **مفيش جدولة**: لازم تبعت دلوقتي حالاً
- **مفيش إعادة استخدام**: كل مرة تكتب البيانات من الأول

## التحسينات المقترحة

### 1. اختيار مرن من كل قوالب الإيميل
- استبدال الـ Select اللي فيه نوعين بقائمة كاملة من القوالب النشطة في `email_templates` (يقدر يختار أي قالب أنشأه الأدمن)
- لو القالب فيه متغيرات (`{{studentName}}`, `{{amount}}`...)، تظهر حقول ديناميكية لإدخالها
- معاينة فورية للموضوع ونص الإيميل قبل الإرسال (Preview Dialog)

### 2. اختيار مرن للمستلم
خيارات Radio:
- **ولي الأمر فقط** (السلوك الحالي)
- **الطالب فقط** (إيميل الطالب من بروفايله)
- **الاتنين** (ولي الأمر + الطالب — كل واحد يستلم نسخة)
- **ذكي**: ولي الأمر لو موجود، يفول-باك للطالب

### 3. فلاتر متقدمة للطلاب
بدل البحث النصي بس، نضيف فلاتر متعددة:
- **حسب المجموعة** (multi-select من المجموعات النشطة)
- **حسب المستوى** (Level 0, 1, 2 Software, 2 Hardware, 3)
- **حسب حالة الاشتراك**: نشط / يحتاج تجديد / منتهي
- **حسب الفئة العمرية** (6-9, 10-13, 14+)
- **بدون ولي أمر مرتبط** (toggle)
- **بدون إيميل** (toggle لاستبعادهم)

### 4. اختيارات سريعة (Quick Selects)
أزرار للاختيار السريع:
- "كل طلاب مجموعة X"
- "كل اللي محتاجين تجديد"
- "كل اللي عليهم متأخرات هذا الشهر" (من جدول `payments` و `subscriptions`)
- "كل طلاب المستوى X"

### 5. تخصيص الموضوع والمحتوى
- مربع نص لتعديل **موضوع الإيميل** قبل الإرسال (override للقالب الافتراضي)
- مربع نص لإضافة **رسالة شخصية** تتركب فوق القالب
- **متغيرات تلقائية** زي `{اسم_الطالب}` و `{اسم_ولي_الأمر}` و `{اسم_المجموعة}` تتعبأ تلقائياً لكل مستلم

### 6. جدولة الإرسال (Schedule)
- خيار "إرسال الآن" (السلوك الحالي)
- خيار "جدولة لتاريخ ووقت محدد" — يخزن في جدول جديد `scheduled_bulk_reminders` و edge function تشغل كل 5 دقائق تنفذ الجدولة

### 7. حفظ كقالب جاهز (Saved Presets)
- "حفظ هذه الإعدادات كقالب سريع" — يخزن (نوع القالب + الفلاتر + النص المخصص) في `bulk_reminder_presets`
- قائمة منسدلة بالـ presets المحفوظة عشان يعيد استخدامها

### 8. تحسين الـ UX والنتائج
- **شريط تقدم** أوضح أثناء الإرسال
- **زر إلغاء** أثناء الإرسال
- **تصدير النتائج CSV** (نجح/فشل/تم تخطي)
- **Retry** للرسائل الفاشلة بزر واحد
- إحصائيات: "هتبعت لـ X مستلم، استبعدنا Y بدون إيميل"

## التغييرات التقنية

### Frontend
- `src/pages/BulkReminders.tsx`: إعادة هيكلة كاملة لـ 3 خطوات (Wizard أو Tabs):
  1. **اختيار القالب والمحتوى** (template picker + variables editor + preview)
  2. **اختيار المستلمين** (advanced filters + quick selects + table with selection)
  3. **المراجعة والإرسال** (recipients summary + schedule option + send/schedule button)
- مكونات جديدة:
  - `src/components/bulk-reminders/TemplatePicker.tsx`
  - `src/components/bulk-reminders/StudentFilters.tsx`
  - `src/components/bulk-reminders/QuickSelects.tsx`
  - `src/components/bulk-reminders/EmailPreview.tsx`
  - `src/components/bulk-reminders/SendResults.tsx`

### Backend (Database)
جدولين جداد:
```sql
CREATE TABLE bulk_reminder_presets (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  template_name text NOT NULL,
  filters jsonb,
  custom_subject text,
  custom_message text,
  recipient_mode text, -- parent | student | both | smart
  created_by uuid,
  created_at timestamptz
);

CREATE TABLE scheduled_bulk_reminders (
  id uuid PRIMARY KEY,
  scheduled_at timestamptz NOT NULL,
  template_name text,
  recipient_user_ids uuid[],
  template_data jsonb,
  status text, -- pending | sent | cancelled
  created_by uuid,
  ...
);
```
مع RLS policies للأدمن والريسبشن.

### Edge Functions
- **توسيع `send-email`**: يقبل `customSubject` و `customBody` كـ override للقالب
- **edge function جديدة `process-scheduled-reminders`**: تشتغل كل 5 دقائق عبر pg_cron، تجيب الجدولات اللي حان وقتها وتبعتها

## ملاحظات

- التحسينات هتحافظ على السلوك القديم (الـ idempotency keys + الـ skip logic)
- مفيش حذف لأي وظيفة موجودة، كل التحسينات additive
- اللوكاليزيشن RTL/AR محفوظة في كل العناصر الجديدة
- الفلاتر هتستخدم الـ joins الموجودة (`group_students`, `subscriptions`, `parent_students`)

## ترتيب التنفيذ

1. توسيع الفلاتر + اختيار القالب الديناميكي + اختيار المستلم (الأهم)
2. تخصيص الموضوع/المحتوى + المعاينة
3. الـ Quick Selects + الـ Presets
4. الجدولة (آخر حاجة لأنها تحتاج cron job)

