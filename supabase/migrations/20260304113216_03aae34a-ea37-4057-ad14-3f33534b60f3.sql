-- Update descriptions with student counts
UPDATE landing_plans SET description_en = '6-8 students per group', description_ar = 'من 6 إلى 8 طلاب في المجموعة' WHERE name_en = 'KOJO SQUAD';
UPDATE landing_plans SET description_en = '2-3 students per group', description_ar = 'من 2 إلى 3 طلاب في المجموعة' WHERE name_en = 'KOJO CORE';
UPDATE landing_plans SET description_en = '1-on-1 private sessions', description_ar = 'حصص فردية خاصة' WHERE name_en = 'KOJO X';

-- Update max_students
UPDATE landing_plans SET max_students = 8 WHERE name_en = 'KOJO SQUAD';
UPDATE landing_plans SET max_students = 3 WHERE name_en = 'KOJO CORE';
UPDATE landing_plans SET max_students = 1 WHERE name_en = 'KOJO X';

-- Delete old Squad benefit
DELETE FROM landing_plan_benefits WHERE plan_id = '06b29a34-2990-447a-bf17-adffe4cf2a96';

-- Add Squad benefits based on reference
INSERT INTO landing_plan_benefits (plan_id, text_en, text_ar, sort_order) VALUES
('06b29a34-2990-447a-bf17-adffe4cf2a96', 'Suitable for social children', 'مناسب للأطفال الاجتماعيين', 1),
('06b29a34-2990-447a-bf17-adffe4cf2a96', 'Monthly review session', 'جلسة مراجعة شهريًا', 2),
('06b29a34-2990-447a-bf17-adffe4cf2a96', 'Study slides for revision', 'يحصل على Slides للمذاكرة', 3),
('06b29a34-2990-447a-bf17-adffe4cf2a96', 'Monthly parent follow-up', 'متابعة شهرية لولي الأمر', 4),
('06b29a34-2990-447a-bf17-adffe4cf2a96', 'Additional learning materials', 'مواد تعليمية إضافية', 5),
('06b29a34-2990-447a-bf17-adffe4cf2a96', 'Certified certificate', 'شهادة معتمدة', 6);

-- Also update Core benefit 6 (was "small group sessions") to be more specific
UPDATE landing_plan_benefits SET text_en = 'Small group (2-3 students)', text_ar = 'جروب صغير (2-3 طلاب)' WHERE plan_id = 'fb30eb4a-9daf-49f4-af6f-9128e3a7cbcd' AND sort_order = 6;
