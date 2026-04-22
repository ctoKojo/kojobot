
INSERT INTO public.email_event_mappings (event_key, audience, send_to, template_id, is_enabled, admin_channel_override)
SELECT 
  ec.event_key,
  'admin',
  'admin',
  t.id,
  true,
  'telegram_only'
FROM public.email_event_catalog ec
JOIN public.email_templates t ON t.name = ec.event_key
WHERE ec.event_key IN (
  'admin-payment-recorded','admin-expense-recorded','admin-salary-paid','admin-treasury-transfer',
  'admin-student-created','admin-student-deleted','admin-subscription-renewed','admin-student-transferred',
  'admin-parent-approved','admin-parent-linked','admin-parent-registered',
  'admin-certificate-issued','admin-level-completed','admin-makeup-created','admin-leave-requested',
  'admin-subscription-request','admin-employee-warning','admin-group-created'
)
ON CONFLICT DO NOTHING;
