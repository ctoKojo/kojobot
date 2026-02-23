

# تفعيل وتأمين نظام مراقبة الـ SLA -- التنفيذ النهائي

## الخطوات بالترتيب

### الخطوة 1: إضافة CRON_SECRET كـ Secret

إنشاء secret باسم `CRON_SECRET` بقيمة عشوائية قوية (32+ bytes).
سيُستخدم في:
- `compliance-monitor`
- `process-deductions`
- `auto-complete-sessions` (موجود بالفعل في الكود لكن الـ secret مش مضاف)

### الخطوة 2: تأمين `compliance-monitor/index.ts`

إضافة Auth Check بعد فحص OPTIONS مباشرة (نفس نمط `auto-complete-sessions`):

```text
// بعد سطر 27 (return 'ok' for OPTIONS)
// إضافة:
const authHeader = req.headers.get('Authorization');
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cronSecret = Deno.env.get('CRON_SECRET');
const token = authHeader?.replace('Bearer ', '') ?? '';
const isServiceRole = token === supabaseKey;
const isCronAuth = cronSecret && token === cronSecret;

if (!isServiceRole && !isCronAuth) {
  console.warn('[Compliance Monitor] Unauthorized access attempt');
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

تعديل الكود بحيث يُقرأ `supabaseServiceKey` من المتغير اللي اتعرف فوق بدل ما يتعرف تاني.

### الخطوة 3: تأمين `process-deductions/index.ts`

نفس النمط بالظبط -- إضافة Auth Check بعد OPTIONS:

```text
// بعد سطر 12 (return 'ok' for OPTIONS)
// إضافة:
const authHeader = req.headers.get('Authorization');
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cronSecret = Deno.env.get('CRON_SECRET');
const token = authHeader?.replace('Bearer ', '') ?? '';
const isServiceRole = token === supabaseKey;
const isCronAuth = cronSecret && token === cronSecret;

if (!isServiceRole && !isCronAuth) {
  console.warn('[Process Deductions] Unauthorized access attempt');
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

ثم تعديل الكود بحيث يستخدم `supabaseKey` اللي اتعرف فوق بدل `supabaseServiceKey` اللي جوه try.

### الخطوة 4: تحديث `supabase/config.toml`

إضافة:
```toml
[functions.compliance-monitor]
verify_jwt = false

[functions.process-deductions]
verify_jwt = false
```

### الخطوة 5: إنشاء Cron Jobs

تشغيل SQL مباشر (مش migration) لإنشاء الجدولة:

```sql
-- compliance-monitor: كل ساعة عند الدقيقة 0
SELECT cron.schedule(
  'compliance-monitor-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://jwkoqnvkvlyqbwydehfm.supabase.co/functions/v1/compliance-monitor',
    headers:=format('{"Content-Type": "application/json", "Authorization": "Bearer %s"}',
      current_setting('app.settings.cron_secret', true))::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);

-- process-deductions: كل ساعة عند الدقيقة 30
SELECT cron.schedule(
  'process-deductions-hourly',
  '30 * * * *',
  $$
  SELECT net.http_post(
    url:='https://jwkoqnvkvlyqbwydehfm.supabase.co/functions/v1/process-deductions',
    headers:=format('{"Content-Type": "application/json", "Authorization": "Bearer %s"}',
      current_setting('app.settings.cron_secret', true))::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);
```

ملاحظة: لو `current_setting('app.settings.cron_secret')` مش متاح، هنستخدم الـ CRON_SECRET مباشرة في الـ SQL (مرة واحدة من بيئة آمنة، مش في migration file).

### الخطوة 6: اختبار

- استدعاء الفانكشن بدون header -- لازم يرجع 401
- استدعاء بالـ CRON_SECRET -- لازم يرجع 200
- التأكد من ظهور الـ Cron Jobs في القائمة

---

## الملفات المتأثرة

| الملف | التغيير |
|-------|---------|
| Secret: `CRON_SECRET` | إنشاء جديد |
| `supabase/functions/compliance-monitor/index.ts` | إضافة Auth Check |
| `supabase/functions/process-deductions/index.ts` | إضافة Auth Check |
| `supabase/config.toml` | إضافة verify_jwt = false للفانكشنين |
| SQL (تنفيذ مباشر) | إنشاء cron jobs |

