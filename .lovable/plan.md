

# تنظيف قاعدة البيانات للنشر

## الوضع الحالي

4 مستخدمين موجودين:
- `sysadmin@kojobot.com` (admin) -- سيتم الاحتفاظ به
- `farisawad@kojobot.com` (instructor) -- سيتم حذفه
- `kojo027@kojobot.com` (student) -- سيتم حذفه
- `basma@kojobot.com` (reception) -- سيتم حذفه

البيانات الموجودة: 2 مجموعات، 24 جلسة، 1 حضور، 1 اشتراك، 1 دفعة، 2 جلسة تعويض، 1 مادة، 1 اشعار، 49 سجل نشاط، 1 راتب، 1 جدول، 1 طالب في مجموعة.

## خطة التنفيذ

سيتم استدعاء edge function `delete-users` الموجودة مع `keepEmail: "sysadmin@kojobot.com"` لحذف المستخدمين الثلاثة من `auth.users` و `profiles` و `user_roles`.

ثم تنظيف باقي الجداول يدويا بترتيب يراعي العلاقات (foreign keys):

1. حذف البيانات الفرعية اولا: attendance, quiz_submissions, assignment_submissions, quiz_assignments, payments, salary_payments, notifications, activity_logs, makeup_sessions, instructor_warnings, instructor_schedules, group_students, group_level_progress
2. حذف البيانات الوسيطة: sessions, subscriptions, quiz_questions, quizzes, assignments, materials, employee_salaries
3. حذف البيانات الاساسية: groups

## ملاحظات
- الادمن `sysadmin@kojobot.com` سيبقى كما هو بكل بياناته
- لا حاجة لتعديل كود او migrations
- العملية ستتم عبر استدعاء الـ edge function + حذف مباشر للبيانات

