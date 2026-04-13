
-- Parent link codes table
CREATE TABLE public.parent_link_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  student_id UUID NOT NULL,
  created_by UUID NOT NULL,
  used_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.parent_link_codes ENABLE ROW LEVEL SECURITY;

-- Admins & reception can create and view codes
CREATE POLICY "Staff can manage link codes"
  ON public.parent_link_codes
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reception')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reception')
  );

-- Parents can look up unused codes (for validation in edge function via service role, but this is a safety net)
CREATE POLICY "Anyone can select by code value"
  ON public.parent_link_codes
  FOR SELECT
  TO authenticated
  USING (used_at IS NULL AND expires_at > now());

-- Index for fast code lookups
CREATE INDEX idx_parent_link_codes_code ON public.parent_link_codes(code);
CREATE INDEX idx_parent_link_codes_student ON public.parent_link_codes(student_id);

-- Audit log table
CREATE TABLE public.parent_link_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL,
  student_id UUID NOT NULL,
  code_id UUID REFERENCES public.parent_link_codes(id),
  action TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.parent_link_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
  ON public.parent_link_audit
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS policy for parent_students: parents can view their own links
CREATE POLICY "Parents can view own links"
  ON public.parent_students
  FOR SELECT
  TO authenticated
  USING (parent_id = auth.uid());
