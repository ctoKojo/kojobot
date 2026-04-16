
-- 1. Cleanup chain: audit → link_codes → auth.users
DELETE FROM public.parent_link_audit 
WHERE code_id IN (
  SELECT id FROM public.parent_link_codes 
  WHERE used_by IN (
    'b2112b62-5af0-4ca2-9492-4227245d9fe3',
    'b0b8db00-d715-4a75-bd9e-66f60d3dd53e',
    '1a19f504-cfa4-43e4-8629-142f5f920d86'
  )
  OR student_id IN (
    'b2112b62-5af0-4ca2-9492-4227245d9fe3',
    'b0b8db00-d715-4a75-bd9e-66f60d3dd53e',
    '1a19f504-cfa4-43e4-8629-142f5f920d86'
  )
  OR created_by IN (
    'b2112b62-5af0-4ca2-9492-4227245d9fe3',
    'b0b8db00-d715-4a75-bd9e-66f60d3dd53e',
    '1a19f504-cfa4-43e4-8629-142f5f920d86'
  )
);

DELETE FROM public.parent_link_codes 
WHERE used_by IN (
  'b2112b62-5af0-4ca2-9492-4227245d9fe3',
  'b0b8db00-d715-4a75-bd9e-66f60d3dd53e',
  '1a19f504-cfa4-43e4-8629-142f5f920d86'
)
OR student_id IN (
  'b2112b62-5af0-4ca2-9492-4227245d9fe3',
  'b0b8db00-d715-4a75-bd9e-66f60d3dd53e',
  '1a19f504-cfa4-43e4-8629-142f5f920d86'
)
OR created_by IN (
  'b2112b62-5af0-4ca2-9492-4227245d9fe3',
  'b0b8db00-d715-4a75-bd9e-66f60d3dd53e',
  '1a19f504-cfa4-43e4-8629-142f5f920d86'
);

DELETE FROM auth.users 
WHERE id IN (
  'b2112b62-5af0-4ca2-9492-4227245d9fe3',
  'b0b8db00-d715-4a75-bd9e-66f60d3dd53e',
  '1a19f504-cfa4-43e4-8629-142f5f920d86'
);

-- 2. Audit trigger
CREATE OR REPLACE FUNCTION public.audit_profile_identity_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      COALESCE(NEW.user_id, OLD.user_id),
      'identity_change', 'profile', NEW.id::text,
      jsonb_build_object('old_user_id', OLD.user_id, 'new_user_id', NEW.user_id, 'severity', 'critical')
    );
  END IF;

  IF OLD.employment_status IS DISTINCT FROM NEW.employment_status THEN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      NEW.user_id, 'employment_status_change', 'profile', NEW.id::text,
      jsonb_build_object('old_status', OLD.employment_status, 'new_status', NEW.employment_status)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_profile_identity ON public.profiles;
CREATE TRIGGER trg_audit_profile_identity
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_profile_identity_changes();

-- 3. Auto-healing function
CREATE OR REPLACE FUNCTION public.heal_orphan_users()
RETURNS TABLE(healed_user_id uuid, healed_email text, action_taken text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE p.user_id IS NULL
  LOOP
    INSERT INTO public.profiles (user_id, email, full_name, full_name_ar)
    VALUES (
      rec.id, rec.email,
      COALESCE(rec.raw_user_meta_data->>'full_name', rec.email),
      COALESCE(rec.raw_user_meta_data->>'full_name', rec.email)
    )
    ON CONFLICT (user_id) DO NOTHING;

    healed_user_id := rec.id;
    healed_email := rec.email;
    action_taken := 'profile_created';
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$;
