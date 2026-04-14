ALTER TABLE public.leave_requests 
ADD COLUMN request_type text NOT NULL DEFAULT 'leave' 
CHECK (request_type IN ('leave', 'absence_excuse'));