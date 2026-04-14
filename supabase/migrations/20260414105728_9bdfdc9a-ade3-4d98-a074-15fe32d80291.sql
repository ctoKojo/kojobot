ALTER TABLE public.leave_requests 
ADD COLUMN session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL DEFAULT NULL;