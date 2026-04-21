-- Backfill missing percentage + final status on auto-graded quiz submissions.
ALTER TABLE public.quiz_submissions DISABLE TRIGGER trg_sync_quiz_to_eval;
ALTER TABLE public.session_evaluations DISABLE TRIGGER trg_eval_lock_24h;
ALTER TABLE public.session_evaluations DISABLE TRIGGER trg_eval_validate_compute;
ALTER TABLE public.session_evaluations DISABLE TRIGGER trg_eval_check_evaluator;
ALTER TABLE public.session_evaluations DISABLE TRIGGER trg_eval_require_attendance;
ALTER TABLE public.session_evaluations DISABLE TRIGGER trg_guard_empty_evaluation;

UPDATE public.quiz_submissions
SET percentage = ROUND((score::numeric / NULLIF(max_score, 0)::numeric) * 100),
    status = 'graded'
WHERE percentage IS NULL
  AND grading_status = 'auto_graded'
  AND score IS NOT NULL
  AND max_score IS NOT NULL
  AND max_score > 0;

UPDATE public.session_evaluations se
SET quiz_score = qs.score,
    quiz_max_score = qs.max_score
FROM public.quiz_submissions qs
JOIN public.quiz_assignments qa ON qa.id = qs.quiz_assignment_id
WHERE se.session_id = qa.session_id
  AND se.student_id = qs.student_id
  AND qs.grading_status = 'auto_graded'
  AND (se.quiz_score IS DISTINCT FROM qs.score OR se.quiz_max_score IS DISTINCT FROM qs.max_score);

ALTER TABLE public.quiz_submissions ENABLE TRIGGER trg_sync_quiz_to_eval;
ALTER TABLE public.session_evaluations ENABLE TRIGGER trg_eval_lock_24h;
ALTER TABLE public.session_evaluations ENABLE TRIGGER trg_eval_validate_compute;
ALTER TABLE public.session_evaluations ENABLE TRIGGER trg_eval_check_evaluator;
ALTER TABLE public.session_evaluations ENABLE TRIGGER trg_eval_require_attendance;
ALTER TABLE public.session_evaluations ENABLE TRIGGER trg_guard_empty_evaluation;