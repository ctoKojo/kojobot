UPDATE public.email_templates
SET
  subject_en = 'Invitation to apply — {{job_title}}',
  subject_ar = 'دعوة للتقديم على وظيفة — {{job_title_ar}}',
  body_html_en = $HTML$
<div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#0f172a;background:#ffffff">
  <div style="text-align:center;padding-bottom:16px;border-bottom:1px solid #e2e8f0">
    <h1 style="margin:0;font-size:22px;color:#0f172a">You're invited to apply</h1>
    <p style="margin:8px 0 0;color:#64748b;font-size:14px">Kojobot Academy</p>
  </div>

  <div style="margin:24px 0">
    <h2 style="margin:0 0 6px;font-size:20px;color:#0f172a">{{job_title}}</h2>
    <div style="display:block;color:#475569;font-size:14px;line-height:1.6">
      <span>{{job_type_en}}</span>
      <span style="margin:0 6px">•</span>
      <span>{{location_en}}</span>
      <span style="margin:0 6px">•</span>
      <span>{{is_paid_label_en}}</span>
    </div>
    <div style="margin-top:6px;color:#475569;font-size:14px">
      <strong>Salary:</strong> {{salary_range}}<br/>
      <strong>Season:</strong> {{training_season}}<br/>
      <strong>Apply before:</strong> {{deadline_at}}
    </div>
  </div>

  {{#personal_message}}
  <div style="background:#f8fafc;border-left:3px solid #6366f1;padding:12px 16px;border-radius:6px;margin:0 0 20px;color:#334155;font-size:14px;line-height:1.6">
    {{personal_message}}
  </div>
  {{/personal_message}}

  <div style="margin:0 0 20px">
    <h3 style="margin:0 0 6px;font-size:15px;color:#0f172a">About the role</h3>
    <div style="color:#334155;font-size:14px;line-height:1.7;white-space:pre-wrap">{{description_en}}</div>
  </div>

  <div style="margin:0 0 20px">
    <h3 style="margin:0 0 6px;font-size:15px;color:#0f172a">Requirements</h3>
    <div style="color:#334155;font-size:14px;line-height:1.7;white-space:pre-wrap">{{requirements_en}}</div>
  </div>

  <div style="margin:0 0 24px">
    <h3 style="margin:0 0 6px;font-size:15px;color:#0f172a">Benefits</h3>
    <div style="color:#334155;font-size:14px;line-height:1.7;white-space:pre-wrap">{{benefits_en}}</div>
  </div>

  <div style="text-align:center;margin:28px 0">
    <a href="{{apply_url}}" style="background:#6366f1;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Apply Now</a>
  </div>

  <p style="color:#94a3b8;font-size:12px;text-align:center;margin:16px 0 0">This invitation expires on {{expires_at}}.</p>
</div>
$HTML$,
  body_html_ar = $HTML$
<div dir="rtl" style="font-family:Tajawal,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#0f172a;background:#ffffff;text-align:right">
  <div style="text-align:center;padding-bottom:16px;border-bottom:1px solid #e2e8f0">
    <h1 style="margin:0;font-size:22px;color:#0f172a">دعوة للتقديم على وظيفة</h1>
    <p style="margin:8px 0 0;color:#64748b;font-size:14px">أكاديمية كوجوبوت</p>
  </div>

  <div style="margin:24px 0">
    <h2 style="margin:0 0 6px;font-size:20px;color:#0f172a">{{job_title_ar}}</h2>
    <div style="display:block;color:#475569;font-size:14px;line-height:1.6">
      <span>{{job_type_ar}}</span>
      <span style="margin:0 6px">•</span>
      <span>{{location_ar}}</span>
      <span style="margin:0 6px">•</span>
      <span>{{is_paid_label_ar}}</span>
    </div>
    <div style="margin-top:6px;color:#475569;font-size:14px">
      <strong>الراتب:</strong> {{salary_range}}<br/>
      <strong>الموسم:</strong> {{training_season}}<br/>
      <strong>آخر موعد للتقديم:</strong> {{deadline_at}}
    </div>
  </div>

  {{#personal_message}}
  <div style="background:#f8fafc;border-right:3px solid #6366f1;padding:12px 16px;border-radius:6px;margin:0 0 20px;color:#334155;font-size:14px;line-height:1.6">
    {{personal_message}}
  </div>
  {{/personal_message}}

  <div style="margin:0 0 20px">
    <h3 style="margin:0 0 6px;font-size:15px;color:#0f172a">عن الوظيفة</h3>
    <div style="color:#334155;font-size:14px;line-height:1.7;white-space:pre-wrap">{{description_ar}}</div>
  </div>

  <div style="margin:0 0 20px">
    <h3 style="margin:0 0 6px;font-size:15px;color:#0f172a">المتطلبات</h3>
    <div style="color:#334155;font-size:14px;line-height:1.7;white-space:pre-wrap">{{requirements_ar}}</div>
  </div>

  <div style="margin:0 0 24px">
    <h3 style="margin:0 0 6px;font-size:15px;color:#0f172a">المميزات</h3>
    <div style="color:#334155;font-size:14px;line-height:1.7;white-space:pre-wrap">{{benefits_ar}}</div>
  </div>

  <div style="text-align:center;margin:28px 0">
    <a href="{{apply_url}}" style="background:#6366f1;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">قدّم الآن</a>
  </div>

  <p style="color:#94a3b8;font-size:12px;text-align:center;margin:16px 0 0">تنتهي الدعوة بتاريخ {{expires_at}}.</p>
</div>
$HTML$,
  subject_telegram_en = '💼 You''re invited — {{job_title}}',
  subject_telegram_ar = '💼 دعوة للتقديم — {{job_title_ar}}',
  body_telegram_md_en = $TG$💼 *{{job_title}}*
{{job_type_en}} • {{location_en}} • {{is_paid_label_en}}

💰 Salary: {{salary_range}}
📅 Season: {{training_season}}
⏰ Apply before: {{deadline_at}}

📝 *About:*
{{description_en}}

✅ *Requirements:*
{{requirements_en}}

🎁 *Benefits:*
{{benefits_en}}

👉 Apply: {{apply_url}}
_Expires: {{expires_at}}_$TG$,
  body_telegram_md_ar = $TG$💼 *{{job_title_ar}}*
{{job_type_ar}} • {{location_ar}} • {{is_paid_label_ar}}

💰 الراتب: {{salary_range}}
📅 الموسم: {{training_season}}
⏰ آخر موعد: {{deadline_at}}

📝 *عن الوظيفة:*
{{description_ar}}

✅ *المتطلبات:*
{{requirements_ar}}

🎁 *المميزات:*
{{benefits_ar}}

👉 قدّم: {{apply_url}}
_تنتهي: {{expires_at}}_$TG$,
  updated_at = now()
WHERE name = 'job-invite-to-apply';