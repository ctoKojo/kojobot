-- Create leave_requests table
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  parent_id uuid NOT NULL,
  request_date date NOT NULL,
  end_date date,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Parents can view their own requests
CREATE POLICY "Parents can view own leave requests"
ON public.leave_requests
FOR SELECT
TO authenticated
USING (parent_id = auth.uid());

-- Parents can create leave requests
CREATE POLICY "Parents can create leave requests"
ON public.leave_requests
FOR INSERT
TO authenticated
WITH CHECK (parent_id = auth.uid());

-- Parents can update their own pending requests
CREATE POLICY "Parents can update own pending requests"
ON public.leave_requests
FOR UPDATE
TO authenticated
USING (parent_id = auth.uid() AND status = 'pending')
WITH CHECK (parent_id = auth.uid());

-- Admin/Reception can view all leave requests
CREATE POLICY "Admin and reception can view all leave requests"
ON public.leave_requests
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reception'));

-- Admin/Reception can update leave requests (approve/reject)
CREATE POLICY "Admin and reception can update leave requests"
ON public.leave_requests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reception'));

-- Create index for faster queries
CREATE INDEX idx_leave_requests_parent_id ON public.leave_requests(parent_id);
CREATE INDEX idx_leave_requests_student_id ON public.leave_requests(student_id);
CREATE INDEX idx_leave_requests_status ON public.leave_requests(status);