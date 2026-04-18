
المستخدم عايز يمسح (يعطّل) كل إنذارات المدربين المرتبطة بسيشنات قبل تاريخ 17 أبريل 2026، لأن نظام المراقبة بدأ يشتغل من 17-4 وأي إنذارات قبل كده مش دقيقة.

## الخطة

**1. التحقق من البيانات أولاً (read-only)**
- استعلام عدّ الإنذارات النشطة المرتبطة بسيشنات تاريخها قبل 2026-04-17 لمعرفة الحجم.

**2. تنفيذ التعطيل عبر migration**
- `UPDATE public.instructor_warnings` لجعل `is_active = false` لكل صف:
  - `is_active = true` حالياً
  - `session_id` يخص سيشن `session_date < '2026-04-17'`
- نستخدم migration لأن العملية UPDATE وليست INSERT.

**3. التحقق بعد التنفيذ**
- استعلام للتأكد إن مفيش إنذارات نشطة لسيشنات قبل 17-4.

## SQL المتوقع

```sql
UPDATE public.instructor_warnings iw
SET is_active = false,
    updated_at = now()
WHERE iw.is_active = true
  AND iw.session_id IN (
    SELECT s.id FROM public.sessions s
    WHERE s.session_date < '2026-04-17'
  );
```

## الملفات المتأثرة
- migration جديد لتعطيل الإنذارات القديمة فقط (لا تغييرات على الكود).

## النتيجة المتوقعة
- صفحة `/my-instructor-warnings` و `InstructorWarnings` للأدمن مش هيظهر فيها أي إنذار من سيشنات قبل 17-4-2026.
- الإنذارات من 17-4 وما بعد تفضل كما هي.
