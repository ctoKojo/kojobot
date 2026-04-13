-- Drop the absolute unique constraint on student_id
ALTER TABLE public.subscriptions DROP CONSTRAINT subscriptions_student_id_key;

-- Add a partial unique index: only one ACTIVE subscription per student
CREATE UNIQUE INDEX subscriptions_student_active_unique ON public.subscriptions (student_id) WHERE (status = 'active');