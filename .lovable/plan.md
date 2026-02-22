

# حضور أونلاين تلقائي + قيود زمنية + فتح الجلسة في تاب جديدة

## ملخص

النظام يحقق 3 أهداف:
1. الجلسة تفتح في تاب جديدة فيها Jitsi + heartbeat في نفس التاب
2. قيود زمنية على دخول الجلسة بناء على توقيت القاهرة
3. تسجيل حضور أوتوماتيك للطلاب الأونلاين عبر heartbeat + finalize على السيرفر

---

## 1. قاعدة البيانات

### جدول جديد: `online_attendance_logs`

| عمود | نوع | وصف |
|-------|------|------|
| id | uuid PK | |
| session_id | uuid NOT NULL | |
| group_id | uuid NOT NULL | للاستعلامات السريعة |
| student_id | uuid NOT NULL | |
| first_joined_at | timestamptz NOT NULL default now() | وقت أول دخول (محمي من التعديل) |
| last_seen_at | timestamptz NOT NULL default now() | آخر heartbeat |
| heartbeat_count | integer default 0 | عدد الـ heartbeats |
| attendance_status_initial | text NOT NULL | present / late / absent -- يتسجل وقت الدخول |
| status | text default 'active' | active / completed / dropped |
| created_at | timestamptz default now() | |

- UNIQUE constraint على (session_id, student_id)
- Trigger يمنع تعديل `first_joined_at` و `attendance_status_initial` بعد أول insert
- `total_minutes` لا يتحسب من العميل -- يتحسب في الـ finalize من الفرق بين `first_joined_at` و `last_seen_at`

### RLS
- الطالب: INSERT سجله فقط (student_id = auth.uid())
- الطالب: UPDATE فقط `last_seen_at` و `heartbeat_count` (student_id = auth.uid())
- الطالب لا يقدر يغير `status` أو `first_joined_at` أو `attendance_status_initial` (عبر trigger)
- الأدمن والمدرب: SELECT الكل

### Trigger: حماية الحقول الحساسة
```text
BEFORE UPDATE:
  لو OLD.first_joined_at != NEW.first_joined_at --> RAISE EXCEPTION
  لو OLD.attendance_status_initial != NEW.attendance_status_initial --> RAISE EXCEPTION
  لو caller ليس service_role:
    لو OLD.status != NEW.status --> RAISE EXCEPTION (status يتغير من السيرفر فقط)
```

---

## 2. ملفات جديدة

### `src/lib/sessionJoinGuard.ts`
دالة تحدد هل المستخدم يقدر يدخل بناء على توقيت القاهرة (نفس pattern الـ `sessionTimeGuard.ts` -- Intl.DateTimeFormat بدون luxon).

```text
getSessionJoinStatus(sessionDate, sessionTime, durationMinutes, role):
  returns {
    canJoin: boolean
    reason: 'too_early' | 'on_time' | 'late' | 'too_late' | 'session_ended'
    attendanceStatus: 'present' | 'late' | 'absent' | null
    minutesUntilStart: number | null
    minutesSinceStart: number | null
  }

قواعد الطالب:
  - قبل الميعاد --> ممنوع (too_early) + عد تنازلي
  - 0 - 15 دقيقة --> مسموح + حالة present
  - 15 - 20 دقيقة --> مسموح + حالة late
  - بعد 20 دقيقة لحد نهاية السيشن --> مسموح كمتفرج + حالة absent (مع banner تحذيري)
  - بعد نهاية السيشن --> ممنوع (session_ended)

المدرب:
  - قبل الميعاد بـ 5 دقائق --> ممنوع
  - بعد كده --> مسموح بدون قيود

الأدمن:
  - مسموح في أي وقت
```

ملاحظة مهمة: الفرونت يعرض الرسائل والعد التنازلي. لكن القرار النهائي للحضور (present/late/absent) يتسجل على السيرفر في الـ finalize بناء على `first_joined_at` الفعلي.

### `src/hooks/useOnlineAttendance.ts`
Hook يدير heartbeat -- يشتغل في نفس التاب اللي فيها Jitsi.

```text
useOnlineAttendance(sessionId, groupId, studentId, attendanceStatus, enabled):
  1. عند التفعيل: UPSERT في online_attendance_logs
     (first_joined_at = now(), attendance_status_initial = attendanceStatus)
  2. كل 45 ثانية: UPDATE last_seen_at = now(), heartbeat_count++
     (الطالب لا يبعت total_minutes -- السيرفر يحسبها)
  3. عند beforeunload: آخر heartbeat update
  4. Cleanup: يوقف الـ interval
```

### `supabase/functions/finalize-online-attendance/index.ts`
Edge function تشتغل عبر cron كل 5 دقائق.

```text
المنطق:
1. تجلب السيشنات المكتملة (status = 'completed') في جروبات أونلاين
   اللي مالهاش attendance مسجل بعد
2. لكل سيشن:
   a. SELECT FOR UPDATE على السيشن (lock)
   b. تحقق إن مفيش attendance مسجل (idempotent)
   c. جلب كل الطلاب النشطين في الجروب
   d. لكل طالب:
      - حساب total_minutes = EXTRACT(EPOCH FROM last_seen_at - first_joined_at) / 60
        مع سقف = duration_minutes
      - لو مالوش سجل في online_attendance_logs --> absent
      - لو total_minutes < min(duration * 0.6, 40) --> absent
      - لو total_minutes >= الحد + first_joined_at في أول 15 دقيقة --> present
      - لو total_minutes >= الحد + first_joined_at بين 15-20 دقيقة --> late
   e. استدعاء save_attendance RPC (الموجود حاليا)
3. تحديث online_attendance_logs.status = 'completed' أو 'dropped'
   (dropped لو last_seen_at أقدم من 3 دقائق)

الأمان:
- CRON_SECRET أو Service Role للتوثيق (نفس pattern auto-complete-sessions)
- verify_jwt = false في config.toml
- Idempotent: يتحقق من attendance موجود قبل التسجيل
- Lock: SELECT FOR UPDATE على السيشن
```

انتهاء السيشن يعتمد على `session_date + session_time + duration_minutes` (نفس المنطق الموجود في `auto-complete-sessions`).

---

## 3. ملفات معدلة

### `src/pages/LiveSession.tsx` (تغيير جذري)
الصفحة تبقى في تاب جديدة وفيها Jitsi + heartbeat.

```text
التغييرات:
1. تجلب أقرب سيشن scheduled للجروب اليوم (بنافذة زمنية: من 1 ساعة قبل الآن لحد 6 ساعات بعده)
2. تتحقق من التوقيت عبر getSessionJoinStatus()
3. حسب الحالة:
   - too_early: عد تنازلي + auto-refresh كل 30 ثانية
   - on_time: Jitsi + heartbeat (present)
   - late: Jitsi + heartbeat (late) + banner "سيتم تسجيلك متأخرا"
   - too_late: Jitsi + heartbeat (absent) + banner "ستسجل غائبا"
   - session_ended: رسالة "الجلسة انتهت"
   - لا توجد سيشن: رسالة "لا توجد جلسة مجدولة اليوم"
4. useOnlineAttendance يشتغل في نفس التاب
5. هيدر فيه اسم الجروب + زر "ارجع للمنصة"
```

### `src/components/dashboard/StudentDashboard.tsx`
- زر "انضم للجلسة" يفتح في تاب جديدة: `window.open('/live-session/' + groupId, '_blank')`

### `src/pages/SessionDetails.tsx`
- أزرار "Join Session" تفتح في تاب جديدة: `window.open()`

### `src/pages/GroupDetails.tsx`
- زر "انضم من داخل المنصة" يفتح في تاب جديدة: `window.open()`

### `supabase/config.toml`
- إضافة `[functions.finalize-online-attendance]` مع `verify_jwt = false`

---

## 4. Cron Job

```text
كل 5 دقائق:
  net.http_post → finalize-online-attendance
  مع Authorization: Bearer CRON_SECRET أو ANON_KEY
```

يتضاف عبر SQL insert (مش migration) لأنه يحتوي بيانات خاصة بالمشروع.

---

## 5. ترتيب التنفيذ

1. Migration: جدول `online_attendance_logs` + trigger حماية الحقول + RLS
2. `src/lib/sessionJoinGuard.ts`
3. `src/hooks/useOnlineAttendance.ts`
4. تعديل `src/pages/LiveSession.tsx` (إضافة جلب السيشن + التحقق الزمني + heartbeat)
5. تعديل أزرار الانضمام (StudentDashboard, SessionDetails, GroupDetails) لتفتح في تاب جديدة
6. `supabase/functions/finalize-online-attendance/index.ts` + config.toml
7. Cron job

---

## ملاحظات أمنية

- `total_minutes` لا يتحسب من العميل -- السيرفر يحسبه من `first_joined_at` و `last_seen_at`
- `first_joined_at` و `attendance_status_initial` محميين من التعديل بـ trigger
- `status` لا يتغير من العميل (trigger يمنع)
- الفرونت يعرض تحذيرات فقط -- القرار النهائي للحضور يتم على السيرفر
- الـ finalize idempotent ومعاه lock

