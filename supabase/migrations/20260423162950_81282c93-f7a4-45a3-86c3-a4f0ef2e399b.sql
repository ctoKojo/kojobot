
UPDATE public.email_templates
SET body_html_ar = regexp_replace(
  body_html_ar,
  '<p style="margin:0;color:#fff;font-size:22px;font-weight:800">أكاديمية Kojobot</p>',
  '<img src="https://lrouvlmandrjughswbyw.supabase.co/storage/v1/object/public/email-assets/kojobot-logo-white.png" alt="أكاديمية Kojobot" width="160" style="display:block;margin:0 auto 6px;max-width:160px;height:auto" />',
  'g'
),
updated_at = now()
WHERE body_html_ar LIKE '%>أكاديمية Kojobot</p>%'
  AND body_html_ar NOT LIKE '%kojobot-logo-white%';

-- Also center-align the header td (was right-aligned before, but logo looks better centered)
UPDATE public.email_templates
SET body_html_ar = replace(
  body_html_ar,
  'padding:26px 32px;text-align:right"><img src="https://lrouvlmandrjughswbyw.supabase.co/storage/v1/object/public/email-assets/kojobot-logo-white.png"',
  'padding:26px 32px;text-align:center"><img src="https://lrouvlmandrjughswbyw.supabase.co/storage/v1/object/public/email-assets/kojobot-logo-white.png"'
),
updated_at = now()
WHERE body_html_ar LIKE '%padding:26px 32px;text-align:right"><img src="https://lrouvlmandrjughswbyw.supabase.co/storage/v1/object/public/email-assets/kojobot-logo-white.png"%';
