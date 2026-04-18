-- 1) رفع min_exam_score لكل المستويات لـ 50 (نفس pass_threshold)
UPDATE public.levels
SET min_exam_score = 50,
    updated_at = now()
WHERE min_exam_score < 50;

-- 2) إعادة محمد احمد زيدان لحالة failed (راسب في الامتحان)
UPDATE public.group_student_progress
SET status = 'exam_scheduled',
    outcome = 'failed',
    graded_at = NULL,
    status_changed_at = now()
WHERE id = 'dd451c5c-591c-4717-8dd7-71feda407d70';

-- 3) حذف سجل الدرجة الخاطئ
DELETE FROM public.level_grades
WHERE student_id = 'd73315e2-8af6-451b-a40e-0d93d090b8b3'
  AND level_id = '5d2db847-acbd-40d8-850b-c0daeed19bb0'
  AND group_id = 'a9714b0b-efac-47a7-975a-74f3ae3d42a5';

-- 4) إلغاء إشعارات النجاح/التجديد/الشهادة الخاطئة
DELETE FROM public.notifications
WHERE id IN (
  '4fc1362a-e44c-4a41-be36-a29e78cea4bc',
  '38fae03c-b0bd-4b28-9924-6a245f6e0f95'
);