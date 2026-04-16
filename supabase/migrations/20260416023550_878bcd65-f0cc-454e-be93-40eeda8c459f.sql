
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY['info','warning','success','error','renewal_needed']));
