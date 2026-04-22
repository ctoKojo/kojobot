
INSERT INTO public.email_event_catalog (event_key, display_name_en, display_name_ar, category, description, supported_audiences, available_variables, preview_data, is_active)
VALUES
  ('admin-payment-recorded', 'Payment recorded', 'تم تسجيل دفعة', 'admin_finance',
   'Notify admin when a new payment is recorded', ARRAY['admin'],
   '[{"key":"studentName","required":true},{"key":"amount","required":true},{"key":"method","required":false},{"key":"recordedBy","required":false}]'::jsonb,
   '{"studentName":"احمد","amount":"1500","method":"كاش","recordedBy":"الاستقبال"}'::jsonb, true),

  ('admin-expense-recorded', 'Expense recorded', 'تم تسجيل مصروف', 'admin_finance',
   'Notify admin when an expense is recorded', ARRAY['admin'],
   '[{"key":"category","required":true},{"key":"amount","required":true},{"key":"description","required":false},{"key":"recordedBy","required":false}]'::jsonb,
   '{"category":"إيجار","amount":"5000","description":"إيجار","recordedBy":"المسؤول"}'::jsonb, true),

  ('admin-salary-paid', 'Salary paid', 'صرف راتب', 'admin_finance',
   'Notify admin when an employee salary is paid', ARRAY['admin'],
   '[{"key":"employeeName","required":true},{"key":"amount","required":true},{"key":"month","required":false}]'::jsonb,
   '{"employeeName":"محمد","amount":"3500","month":"أبريل"}'::jsonb, true),

  ('admin-treasury-transfer', 'Treasury transfer', 'تحويل بين الخزن', 'admin_finance',
   'Notify admin on treasury transfer', ARRAY['admin'],
   '[{"key":"fromAccount","required":true},{"key":"toAccount","required":true},{"key":"amount","required":true}]'::jsonb,
   '{"fromAccount":"الخزينة","toAccount":"البنك","amount":"10000"}'::jsonb, true),

  ('admin-student-created', 'New student created', 'إضافة طالب جديد', 'admin_students',
   'Notify admin on new student', ARRAY['admin'],
   '[{"key":"studentName","required":true},{"key":"phone","required":false},{"key":"createdBy","required":false}]'::jsonb,
   '{"studentName":"سارة","phone":"01012345678","createdBy":"الاستقبال"}'::jsonb, true),

  ('admin-student-deleted', 'Student deleted', 'حذف طالب', 'admin_students',
   'Notify admin on student deletion', ARRAY['admin'],
   '[{"key":"studentName","required":true},{"key":"deletedBy","required":false}]'::jsonb,
   '{"studentName":"خالد","deletedBy":"المسؤول"}'::jsonb, true),

  ('admin-subscription-renewed', 'Subscription renewed', 'تجديد اشتراك', 'admin_students',
   'Notify admin on subscription renewal', ARRAY['admin'],
   '[{"key":"studentName","required":true},{"key":"levelName","required":false},{"key":"amount","required":false}]'::jsonb,
   '{"studentName":"احمد","levelName":"المستوى 2","amount":"4500"}'::jsonb, true),

  ('admin-student-transferred', 'Student transferred', 'نقل طالب لمجموعة', 'admin_students',
   'Notify admin on student transfer', ARRAY['admin'],
   '[{"key":"studentName","required":true},{"key":"fromGroup","required":true},{"key":"toGroup","required":true}]'::jsonb,
   '{"studentName":"احمد","fromGroup":"A","toGroup":"B"}'::jsonb, true),

  ('admin-parent-approved', 'Parent approved', 'موافقة ولي أمر', 'admin_parents',
   'Notify admin on parent approval', ARRAY['admin'],
   '[{"key":"parentName","required":true},{"key":"approvedBy","required":false}]'::jsonb,
   '{"parentName":"محمود","approvedBy":"المسؤول"}'::jsonb, true),

  ('admin-parent-linked', 'Parent linked to student', 'ربط ولي أمر بطالب', 'admin_parents',
   'Notify admin on parent-student link', ARRAY['admin'],
   '[{"key":"parentName","required":true},{"key":"studentName","required":true}]'::jsonb,
   '{"parentName":"محمود","studentName":"احمد"}'::jsonb, true),

  ('admin-parent-registered', 'New parent registered', 'تسجيل ولي أمر جديد', 'admin_parents',
   'Notify admin on new parent registration', ARRAY['admin'],
   '[{"key":"parentName","required":true},{"key":"email","required":false}]'::jsonb,
   '{"parentName":"خالد","email":"k@x.com"}'::jsonb, true),

  ('admin-certificate-issued', 'Certificate issued', 'إصدار شهادة', 'admin_academic',
   'Notify admin on certificate issuance', ARRAY['admin'],
   '[{"key":"studentName","required":true},{"key":"levelName","required":true}]'::jsonb,
   '{"studentName":"احمد","levelName":"المستوى 1"}'::jsonb, true),

  ('admin-level-completed', 'Student completed level', 'طالب أكمل مستوى', 'admin_academic',
   'Notify admin when student passes a level', ARRAY['admin'],
   '[{"key":"studentName","required":true},{"key":"levelName","required":true},{"key":"score","required":false}]'::jsonb,
   '{"studentName":"سارة","levelName":"المستوى 2","score":"85"}'::jsonb, true),

  ('admin-makeup-created', 'Makeup session created', 'إنشاء جلسة تعويضية', 'admin_academic',
   'Notify admin on makeup creation', ARRAY['admin'],
   '[{"key":"studentName","required":true},{"key":"originalDate","required":false},{"key":"makeupDate","required":false}]'::jsonb,
   '{"studentName":"احمد","originalDate":"2026-04-20","makeupDate":"2026-04-25"}'::jsonb, true),

  ('admin-leave-requested', 'New leave request', 'طلب إجازة جديد', 'admin_academic',
   'Notify admin on leave request', ARRAY['admin'],
   '[{"key":"studentName","required":true},{"key":"fromDate","required":true},{"key":"toDate","required":true},{"key":"reason","required":false}]'::jsonb,
   '{"studentName":"احمد","fromDate":"2026-04-25","toDate":"2026-04-28","reason":"سفر"}'::jsonb, true),

  ('admin-subscription-request', 'New subscription inquiry', 'طلب اشتراك جديد', 'admin_academic',
   'Notify admin on new subscription inquiry', ARRAY['admin'],
   '[{"key":"name","required":true},{"key":"phone","required":false},{"key":"plan","required":false}]'::jsonb,
   '{"name":"عمر","phone":"01012345678","plan":"الباقة الشاملة"}'::jsonb, true),

  ('admin-employee-warning', 'Employee warning issued', 'إنذار موظف', 'admin_ops',
   'Notify admin when employee warning is issued', ARRAY['admin'],
   '[{"key":"employeeName","required":true},{"key":"reason","required":true},{"key":"issuedBy","required":false}]'::jsonb,
   '{"employeeName":"محمد","reason":"تأخير","issuedBy":"المسؤول"}'::jsonb, true),

  ('admin-group-created', 'New group created', 'إنشاء مجموعة جديدة', 'admin_ops',
   'Notify admin on new group creation', ARRAY['admin'],
   '[{"key":"groupName","required":true},{"key":"levelName","required":false},{"key":"createdBy","required":false}]'::jsonb,
   '{"groupName":"Group X","levelName":"المستوى 1","createdBy":"المسؤول"}'::jsonb, true)
ON CONFLICT (event_key) DO NOTHING;
