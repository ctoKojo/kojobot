
ALTER TABLE public.notifications DROP CONSTRAINT notifications_category_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_category_check CHECK (category = ANY (ARRAY['general','quiz','assignment','attendance','subscription','system','schedule','academic']));
