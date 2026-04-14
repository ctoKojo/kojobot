UPDATE public.makeup_sessions ms
SET status = 'cancelled'
FROM public.group_student_progress gsp
WHERE ms.student_id = gsp.student_id
  AND ms.group_id = gsp.group_id
  AND ms.status = 'pending'
  AND (gsp.status IN ('awaiting_exam', 'completed') OR gsp.outcome IS NOT NULL);