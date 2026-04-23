
-- Replace the "Kojobot Academy" text header in EN templates with the logo image
UPDATE public.email_templates
SET body_html_en = regexp_replace(
  body_html_en,
  '<p style="margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:-\.5px">Kojobot Academy</p>',
  '<img src="https://lrouvlmandrjughswbyw.supabase.co/storage/v1/object/public/email-assets/kojobot-logo-white.png" alt="Kojobot Academy" width="160" style="display:block;margin:0 auto 6px;max-width:160px;height:auto" />',
  'g'
),
updated_at = now()
WHERE body_html_en LIKE '%>Kojobot Academy</p>%';

-- Replace the "أكاديمية كوجوبوت" text header in AR templates with the logo image
UPDATE public.email_templates
SET body_html_ar = regexp_replace(
  body_html_ar,
  '<p style="margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:-\.5px">أكاديمية كوجوبوت</p>',
  '<img src="https://lrouvlmandrjughswbyw.supabase.co/storage/v1/object/public/email-assets/kojobot-logo-white.png" alt="أكاديمية كوجوبوت" width="160" style="display:block;margin:0 auto 6px;max-width:160px;height:auto" />',
  'g'
),
updated_at = now()
WHERE body_html_ar LIKE '%>أكاديمية كوجوبوت</p>%';

-- Job templates use a separate header style — replace the simple <h1>...</h1> intro with logo + heading
UPDATE public.email_templates
SET body_html_ar = replace(
  body_html_ar,
  '<div style="text-align:center;padding-bottom:16px;border-bottom:1px solid #e2e8f0">
    <h1 style="margin:0;font-size:22px;color:#0f172a">',
  '<div style="text-align:center;padding-bottom:16px;border-bottom:1px solid #e2e8f0">
    <img src="https://lrouvlmandrjughswbyw.supabase.co/storage/v1/object/public/email-assets/kojobot-logo-white.png" alt="Kojobot" width="140" style="display:block;margin:0 auto 12px;max-width:140px;height:auto;background:#6455F0;padding:10px 16px;border-radius:10px" />
    <h1 style="margin:0;font-size:22px;color:#0f172a">'
),
updated_at = now()
WHERE body_html_ar LIKE '%<h1 style="margin:0;font-size:22px;color:#0f172a">%'
  AND body_html_ar NOT LIKE '%kojobot-logo-white%';

UPDATE public.email_templates
SET body_html_en = replace(
  body_html_en,
  '<div style="text-align:center;padding-bottom:16px;border-bottom:1px solid #e2e8f0">
    <h1 style="margin:0;font-size:22px;color:#0f172a">',
  '<div style="text-align:center;padding-bottom:16px;border-bottom:1px solid #e2e8f0">
    <img src="https://lrouvlmandrjughswbyw.supabase.co/storage/v1/object/public/email-assets/kojobot-logo-white.png" alt="Kojobot" width="140" style="display:block;margin:0 auto 12px;max-width:140px;height:auto;background:#6455F0;padding:10px 16px;border-radius:10px" />
    <h1 style="margin:0;font-size:22px;color:#0f172a">'
),
updated_at = now()
WHERE body_html_en LIKE '%<h1 style="margin:0;font-size:22px;color:#0f172a">%'
  AND body_html_en NOT LIKE '%kojobot-logo-white%';

-- Job application simple templates (no header) — prepend a logo bar
UPDATE public.email_templates
SET body_html_en = replace(
  body_html_en,
  '<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff;">',
  '<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff;"><div style="text-align:center;padding:16px 0 20px;border-bottom:1px solid #e5e7eb;margin-bottom:20px"><img src="https://lrouvlmandrjughswbyw.supabase.co/storage/v1/object/public/email-assets/kojobot-logo-white.png" alt="Kojobot" width="140" style="display:inline-block;max-width:140px;height:auto;background:#6455F0;padding:10px 16px;border-radius:10px" /></div>'
),
updated_at = now()
WHERE body_html_en LIKE '<div style="font-family: Arial, sans-serif; max-width: 560px;%'
  AND body_html_en NOT LIKE '%kojobot-logo-white%';

UPDATE public.email_templates
SET body_html_ar = replace(
  body_html_ar,
  '<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff;">',
  '<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff;"><div style="text-align:center;padding:16px 0 20px;border-bottom:1px solid #e5e7eb;margin-bottom:20px"><img src="https://lrouvlmandrjughswbyw.supabase.co/storage/v1/object/public/email-assets/kojobot-logo-white.png" alt="Kojobot" width="140" style="display:inline-block;max-width:140px;height:auto;background:#6455F0;padding:10px 16px;border-radius:10px" /></div>'
),
updated_at = now()
WHERE body_html_ar LIKE '<div style="font-family: Arial, sans-serif; max-width: 560px;%'
  AND body_html_ar NOT LIKE '%kojobot-logo-white%';
