INSERT INTO public.email_event_catalog (event_key, display_name_en, display_name_ar, category, description, is_active, available_variables)
VALUES (
  'announcement',
  'General Announcement',
  'إعلان عام',
  'lifecycle',
  'إعلان حر يكتبه الادمن أو الريسيبشن - الموضوع والنص مخصصين بالكامل',
  true,
  '["recipientName", "studentName"]'::jsonb
)
ON CONFLICT (event_key) DO UPDATE SET
  display_name_en = EXCLUDED.display_name_en,
  display_name_ar = EXCLUDED.display_name_ar,
  description = EXCLUDED.description,
  is_active = true;