

## التشخيص

**حالة النظام الحالية (3 طلاب نجحوا، 0 شهادة):**

| الطالب | المجموعة | المستوى | حالة الـ Lifecycle | شهادة؟ |
|--------|----------|---------|-------------------|--------|
| Elsayed mohamed | T9 | Level 2 Software | `graded` (passed) | ❌ |
| Rawan mohamed | T10 | Level 1 | `graded` (passed) | ❌ |
| Basil wael | T38 | Level 1 | `graded` (passed) | ❌ |

**سبب المشكلة (3 ثغرات في الفلو):**

1. **الشهادة بتتعمل بس وقت الترقية، مش لما الطالب ينجح:** RPC `upgrade_student_level` و `student_choose_track_and_upgrade` هما الوحيدين اللي بيـ `INSERT INTO student_certificates`. لو المسؤول لسه ما عملش "Promote" من صفحة المجموعة، الشهادة مش بتتولد أصلاً. الطلاب التلاتة لسه `graded` ومش `pending_group_assignment`.

2. **مفيش cron يولد شهادات الـ pending تلقائياً:** الـ Edge Function `generate-certificate` موجودة لكن مفيش `cron.job` بيشغلها. لازم أدمن يضغط زر "Generate" يدوياً من تبويب الشهادات في بروفايل الطالب. النتيجة: الشهادات بتفضل `pending` للأبد.

3. **Reception Dashboard بيعد بس الشهادات `ready`:** الـ widget بيعرض `unprintedCertificates` بفلتر `status = 'ready' AND printed_at IS NULL`. الشهادات الـ `pending` (مش متولدة لسه) بتختفي تماماً من رادار الريسيبشن.

## الفلو الصحيح المطلوب

```text
Student passes exam (outcome=passed, status=graded)
         ↓
[AUTO] Trigger creates certificate row (status=pending)
         ↓
[AUTO] Cron job (every 5 min) calls generate-certificate edge function
         ↓
PDF generated → uploaded to storage → status=ready
         ↓
[AUTO] Notification to Reception: "Certificate ready to print"
         ↓
Student sees it in /my-certificates (Download button)
Reception sees count in dashboard widget → opens student profile → prints → marks printed
```

## الخطة (4 خطوات)

### 1. Trigger تلقائي لإنشاء الشهادة عند النجاح
- Migration: trigger جديد `trg_issue_certificate_on_pass` على `level_grades` بعد `INSERT/UPDATE`
- لما `outcome = 'passed'` يعمل `INSERT INTO student_certificates` بـ `status = 'pending'` (مع `ON CONFLICT DO NOTHING`)
- نضيف نفس notification "Certificate Ready to Print" للريسيبشن (اللي حالياً بتتبعت بس وقت الترقية)
- **Backfill يدوي:** إنشاء شهادات pending للطلاب الـ 3 الموجودين حالياً (Elsayed, Rawan, Basil)

### 2. Cron job يشغل التوليد كل 5 دقائق
- Migration: `cron.schedule('generate-pending-certificates', '*/5 * * * *', ...)`
- يستدعي `generate-certificate` edge function بـ `x-cron-secret`
- الـ function بالفعل بتـ batch process الـ pending/failed (lines 162-168)

### 3. Reception Dashboard widget محسّن
- تعديل `ReceptionDashboard.tsx`: عرض عدّادين منفصلين:
  - **شهادات قيد التوليد** (`status IN ('pending','generating','failed')`) — للمتابعة
  - **شهادات جاهزة للطباعة** (`status = 'ready' AND printed_at IS NULL`) — للأكشن
- لينك مباشر لصفحة جديدة `/certificates-queue` تعرض كل الشهادات pending/ready

### 4. صفحة `/certificates-queue` للريسيبشن (جديدة)
- جدول بكل الشهادات اللي مش متطبوعة (pending/generating/ready/failed)
- أكشنز: تحميل، Mark Printed، Retry (للـ failed)
- إضافة لـ `AppSidebar` تحت قسم Reception

## الملفات المتأثرة

**Migrations:**
- Trigger جديد على `level_grades` + cron.job + backfill 3 شهادات

**كود:**
- `src/components/dashboard/ReceptionDashboard.tsx` — widget محسّن
- `src/pages/CertificatesQueue.tsx` — صفحة جديدة
- `src/components/AppSidebar.tsx` — إضافة لينك
- `src/App.tsx` — route جديد

## التحقق النهائي
- إنشاء صف level_grade تجريبي لطالب نجح → التأكد إن الشهادة اتعملت تلقائياً
- انتظار الـ cron → التأكد إن الـ status بقى ready
- التأكد إن الإشعار وصل للريسيبشن وإن الـ widget بيعرض العدد الصحيح

