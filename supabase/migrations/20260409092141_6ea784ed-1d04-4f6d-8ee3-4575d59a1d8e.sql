
-- 1. Storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('certificates', 'certificates', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: admin upload templates
CREATE POLICY "Admins can upload certificate templates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'certificates'
  AND (storage.foldername(name))[1] = 'templates'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Storage policies: admin/reception can read all certificates
CREATE POLICY "Admin and reception can read all certificates"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'certificates'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'reception'::public.app_role)
  )
);

-- Storage policies: students can read their own generated certificates
CREATE POLICY "Students can read own certificates"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'certificates'
  AND (storage.foldername(name))[1] = 'generated'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Storage policies: service role (edge functions) can write generated certs
CREATE POLICY "Service can write generated certificates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'certificates'
  AND (storage.foldername(name))[1] = 'generated'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Storage: admin can delete (for regenerate cleanup)
CREATE POLICY "Admin can delete certificates"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'certificates'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 2. Add certificate_template_path to levels
ALTER TABLE public.levels ADD COLUMN IF NOT EXISTS certificate_template_path TEXT;

-- 3. Create student_certificates table
CREATE TABLE public.student_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  level_id UUID NOT NULL REFERENCES public.levels(id),
  group_id UUID NOT NULL REFERENCES public.groups(id),
  status TEXT NOT NULL DEFAULT 'pending',
  storage_path TEXT,
  certificate_code TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  student_name_snapshot TEXT NOT NULL,
  level_name_snapshot TEXT NOT NULL,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  issued_at TIMESTAMPTZ DEFAULT now(),
  printed_at TIMESTAMPTZ,
  printed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, level_id)
);

-- Validation trigger instead of CHECK constraint for status
CREATE OR REPLACE FUNCTION public.validate_certificate_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'generating', 'ready', 'failed') THEN
    RAISE EXCEPTION 'Invalid certificate status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_certificate_status_trigger
BEFORE INSERT OR UPDATE ON public.student_certificates
FOR EACH ROW EXECUTE FUNCTION public.validate_certificate_status();

-- Updated_at trigger
CREATE TRIGGER update_student_certificates_updated_at
BEFORE UPDATE ON public.student_certificates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_student_certificates_status ON public.student_certificates(status);
CREATE INDEX idx_student_certificates_student_id ON public.student_certificates(student_id);
CREATE INDEX idx_student_certificates_printed ON public.student_certificates(status, printed_at) WHERE status = 'ready' AND printed_at IS NULL;

-- RLS
ALTER TABLE public.student_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own certificates"
ON public.student_certificates FOR SELECT
TO authenticated
USING (student_id = auth.uid());

CREATE POLICY "Admin and reception can view all certificates"
ON public.student_certificates FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'reception'::public.app_role)
);

CREATE POLICY "Admin can insert certificates"
ON public.student_certificates FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "System insert certificates"
ON public.student_certificates FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow upgrade functions (running as the calling user) to insert
  -- The actual insert happens inside security definer functions
  true
);

CREATE POLICY "Admin and reception can update certificates"
ON public.student_certificates FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'reception'::public.app_role)
);

-- 4. Modify upgrade_student_level to insert certificate on upgrade
CREATE OR REPLACE FUNCTION public.upgrade_student_level(
  p_student_id UUID,
  p_group_id UUID,
  p_chosen_track_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_progress RECORD;
  v_next_level_id UUID;
  v_current_level_order INTEGER;
  v_student_name TEXT;
  v_level_name TEXT;
  v_old_level_id UUID;
  v_old_level_name TEXT;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT * INTO v_progress
  FROM group_student_progress
  WHERE group_id = p_group_id AND student_id = p_student_id
  FOR UPDATE;

  IF v_progress IS NULL THEN
    RAISE EXCEPTION 'Student progress not found';
  END IF;

  IF v_progress.outcome != 'passed' THEN
    RAISE EXCEPTION 'Student has not passed the current level';
  END IF;

  -- Save old level info for certificate
  v_old_level_id := v_progress.current_level_id;
  SELECT l.name INTO v_old_level_name FROM levels l WHERE l.id = v_old_level_id;

  -- Determine next level
  IF p_chosen_track_id IS NOT NULL THEN
    SELECT id INTO v_next_level_id
    FROM levels
    WHERE parent_level_id = v_progress.current_level_id
      AND track_id = p_chosen_track_id
      AND is_active = true
    LIMIT 1;

    IF v_next_level_id IS NULL THEN
      RAISE EXCEPTION 'No matching level found for this track';
    END IF;

    INSERT INTO student_track_choices (student_id, group_id, from_level_id, chosen_track_id, chosen_by)
    VALUES (p_student_id, p_group_id, v_progress.current_level_id, p_chosen_track_id, auth.uid())
    ON CONFLICT (student_id, group_id, from_level_id) DO NOTHING;
  ELSE
    SELECT l.level_order INTO v_current_level_order
    FROM levels l WHERE l.id = v_progress.current_level_id;

    SELECT id INTO v_next_level_id
    FROM levels
    WHERE level_order = v_current_level_order + 1
      AND (track_id = v_progress.current_track_id OR (track_id IS NULL AND v_progress.current_track_id IS NULL))
      AND is_active = true
    LIMIT 1;

    IF v_next_level_id IS NULL THEN
      RETURN jsonb_build_object('upgraded', false, 'reason', 'no_next_level');
    END IF;
  END IF;

  -- 1. Log transition
  INSERT INTO student_level_transitions (student_id, group_id, from_level_id, to_level_id, reason, created_by)
  VALUES (p_student_id, p_group_id, v_progress.current_level_id, v_next_level_id, 'passed', auth.uid());

  -- 2. Update progress - set to pending_group_assignment
  UPDATE group_student_progress
  SET level_completed_at = now(),
    current_level_id = v_next_level_id,
    current_track_id = COALESCE(p_chosen_track_id, current_track_id),
    status = 'pending_group_assignment',
    status_changed_at = now(),
    outcome = NULL,
    level_started_at = now(),
    exam_scheduled_at = NULL,
    exam_submitted_at = NULL,
    graded_at = NULL,
    updated_at = now()
  WHERE group_id = p_group_id AND student_id = p_student_id;

  -- 3. Deactivate from old group
  UPDATE group_students
  SET is_active = false
  WHERE student_id = p_student_id AND group_id = p_group_id;

  -- 4. Update profile level
  UPDATE profiles SET level_id = v_next_level_id, updated_at = now()
  WHERE user_id = p_student_id;

  -- 5. Issue certificate for OLD level (the one they passed)
  SELECT p.full_name INTO v_student_name FROM profiles p WHERE p.user_id = p_student_id;
  SELECT l.name INTO v_level_name FROM levels l WHERE l.id = v_next_level_id;

  INSERT INTO student_certificates (student_id, level_id, group_id, status, student_name_snapshot, level_name_snapshot)
  VALUES (p_student_id, v_old_level_id, p_group_id, 'pending', COALESCE(v_student_name, 'Unknown'), COALESCE(v_old_level_name, 'Unknown'))
  ON CONFLICT (student_id, level_id) DO NOTHING;

  -- 6. Notify admin + reception about group assignment
  INSERT INTO notifications (user_id, title, title_ar, message, message_ar, type, category, action_url)
  SELECT
    ur.user_id,
    'Student Needs Group Assignment',
    'طالب يحتاج تعيين في جروب',
    COALESCE(v_student_name, 'Student') || ' upgraded to ' || COALESCE(v_level_name, 'next level') || ' — needs group assignment',
    COALESCE(v_student_name, 'طالب') || ' ترقى إلى ' || COALESCE(v_level_name, 'المستوى التالي') || ' — يحتاج تعيين في جروب',
    'warning',
    'system',
    '/students/' || p_student_id
  FROM user_roles ur
  WHERE ur.role IN ('admin', 'reception');

  -- 7. Notify reception about certificate ready to print
  INSERT INTO notifications (user_id, title, title_ar, message, message_ar, type, category, action_url)
  SELECT
    ur.user_id,
    'Certificate Ready to Print',
    'شهادة جاهزة للطباعة',
    COALESCE(v_student_name, 'Student') || ' — ' || COALESCE(v_old_level_name, 'Level') || ' certificate pending generation',
    COALESCE(v_student_name, 'طالب') || ' — شهادة ' || COALESCE(v_old_level_name, 'المستوى') || ' في انتظار التوليد',
    'info',
    'certificate',
    '/students/' || p_student_id
  FROM user_roles ur
  WHERE ur.role IN ('admin', 'reception');

  RETURN jsonb_build_object('upgraded', true, 'next_level_id', v_next_level_id);
END;
$$;

-- 5. Modify student_choose_track_and_upgrade to insert certificate on upgrade
CREATE OR REPLACE FUNCTION public.student_choose_track_and_upgrade(
  p_group_id UUID,
  p_chosen_track_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_progress RECORD;
  v_next_level_id UUID;
  v_current_level_order INTEGER;
  v_has_branching BOOLEAN;
  v_student_name TEXT;
  v_level_name TEXT;
  v_old_level_id UUID;
  v_old_level_name TEXT;
BEGIN
  v_student_id := auth.uid();

  IF NOT has_role(v_student_id, 'student'::app_role) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT * INTO v_progress
  FROM group_student_progress
  WHERE group_id = p_group_id AND student_id = v_student_id
  FOR UPDATE;

  IF v_progress IS NULL THEN
    RAISE EXCEPTION 'Progress record not found';
  END IF;

  IF v_progress.outcome != 'passed' THEN
    RAISE EXCEPTION 'Student has not passed the current level';
  END IF;

  -- Save old level info for certificate
  v_old_level_id := v_progress.current_level_id;
  SELECT l.name INTO v_old_level_name FROM levels l WHERE l.id = v_old_level_id;

  SELECT EXISTS(
    SELECT 1 FROM levels
    WHERE parent_level_id = v_progress.current_level_id
      AND track_id IS NOT NULL
      AND is_active = true
  ) INTO v_has_branching;

  IF v_has_branching AND p_chosen_track_id IS NOT NULL THEN
    SELECT id INTO v_next_level_id
    FROM levels
    WHERE parent_level_id = v_progress.current_level_id
      AND track_id = p_chosen_track_id
      AND is_active = true
    LIMIT 1;

    IF v_next_level_id IS NULL THEN
      RAISE EXCEPTION 'No matching level found for this track';
    END IF;

    INSERT INTO student_track_choices (student_id, group_id, from_level_id, chosen_track_id, chosen_by)
    VALUES (v_student_id, p_group_id, v_progress.current_level_id, p_chosen_track_id, v_student_id)
    ON CONFLICT (student_id, group_id, from_level_id) DO NOTHING;
  ELSE
    SELECT l.level_order INTO v_current_level_order
    FROM levels l WHERE l.id = v_progress.current_level_id;

    SELECT id INTO v_next_level_id
    FROM levels
    WHERE level_order = v_current_level_order + 1
      AND (track_id = v_progress.current_track_id OR (track_id IS NULL AND v_progress.current_track_id IS NULL))
      AND is_active = true
    LIMIT 1;

    IF v_next_level_id IS NULL THEN
      RETURN jsonb_build_object('upgraded', false, 'reason', 'no_next_level');
    END IF;
  END IF;

  -- 1. Log transition
  INSERT INTO student_level_transitions (student_id, group_id, from_level_id, to_level_id, reason, created_by)
  VALUES (v_student_id, p_group_id, v_progress.current_level_id, v_next_level_id, 'passed', v_student_id);

  -- 2. Update progress - pending_group_assignment
  UPDATE group_student_progress
  SET level_completed_at = now(),
    current_level_id = v_next_level_id,
    current_track_id = COALESCE(p_chosen_track_id, current_track_id),
    status = 'pending_group_assignment',
    status_changed_at = now(),
    outcome = NULL,
    level_started_at = now(),
    exam_scheduled_at = NULL,
    exam_submitted_at = NULL,
    graded_at = NULL,
    updated_at = now()
  WHERE group_id = p_group_id AND student_id = v_student_id;

  -- 3. Deactivate from old group
  UPDATE group_students
  SET is_active = false
  WHERE student_id = v_student_id AND group_id = p_group_id;

  -- 4. Update profile level
  UPDATE profiles SET level_id = v_next_level_id, updated_at = now()
  WHERE user_id = v_student_id;

  -- 5. Issue certificate for OLD level
  SELECT p.full_name INTO v_student_name FROM profiles p WHERE p.user_id = v_student_id;
  SELECT l.name INTO v_level_name FROM levels l WHERE l.id = v_next_level_id;

  INSERT INTO student_certificates (student_id, level_id, group_id, status, student_name_snapshot, level_name_snapshot)
  VALUES (v_student_id, v_old_level_id, p_group_id, 'pending', COALESCE(v_student_name, 'Unknown'), COALESCE(v_old_level_name, 'Unknown'))
  ON CONFLICT (student_id, level_id) DO NOTHING;

  -- 6. Notify admin
  INSERT INTO notifications (user_id, title, title_ar, message, message_ar, type, category, action_url)
  SELECT
    ur.user_id,
    'Student Needs Group Assignment',
    'طالب يحتاج تعيين في جروب',
    COALESCE(v_student_name, 'Student') || ' upgraded to ' || COALESCE(v_level_name, 'next level') || ' — needs group assignment',
    COALESCE(v_student_name, 'طالب') || ' ترقى إلى ' || COALESCE(v_level_name, 'المستوى التالي') || ' — يحتاج تعيين في جروب',
    'warning',
    'system',
    '/students/' || v_student_id
  FROM user_roles ur
  WHERE ur.role IN ('admin', 'reception');

  -- 7. Notify reception about certificate
  INSERT INTO notifications (user_id, title, title_ar, message, message_ar, type, category, action_url)
  SELECT
    ur.user_id,
    'Certificate Ready to Print',
    'شهادة جاهزة للطباعة',
    COALESCE(v_student_name, 'Student') || ' — ' || COALESCE(v_old_level_name, 'Level') || ' certificate pending generation',
    COALESCE(v_student_name, 'طالب') || ' — شهادة ' || COALESCE(v_old_level_name, 'المستوى') || ' في انتظار التوليد',
    'info',
    'certificate',
    '/students/' || v_student_id
  FROM user_roles ur
  WHERE ur.role IN ('admin', 'reception');

  RETURN jsonb_build_object('upgraded', true, 'next_level_id', v_next_level_id);
END;
$$;
