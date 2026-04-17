
-- 1. Trigger function: auto-issue certificate when student passes a level
CREATE OR REPLACE FUNCTION public.issue_certificate_on_pass()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_name TEXT;
  v_level_name TEXT;
  v_inserted_cert_id UUID;
BEGIN
  IF NEW.outcome IS DISTINCT FROM 'passed' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.outcome = 'passed' THEN
    RETURN NEW;
  END IF;

  SELECT p.full_name INTO v_student_name FROM profiles p WHERE p.user_id = NEW.student_id;
  SELECT l.name INTO v_level_name FROM levels l WHERE l.id = NEW.level_id;

  INSERT INTO student_certificates (
    student_id, level_id, group_id, status,
    student_name_snapshot, level_name_snapshot
  )
  VALUES (
    NEW.student_id, NEW.level_id, NEW.group_id, 'pending',
    COALESCE(v_student_name, 'Unknown'),
    COALESCE(v_level_name, 'Unknown')
  )
  ON CONFLICT (student_id, level_id) DO NOTHING
  RETURNING id INTO v_inserted_cert_id;

  IF v_inserted_cert_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, title_ar, message, message_ar, type, category, action_url)
    SELECT
      ur.user_id,
      'Certificate Ready to Print',
      'شهادة جاهزة للطباعة',
      COALESCE(v_student_name, 'Student') || ' — ' || COALESCE(v_level_name, 'Level') || ' certificate pending generation',
      COALESCE(v_student_name, 'طالب') || ' — شهادة ' || COALESCE(v_level_name, 'المستوى') || ' في انتظار التوليد',
      'info',
      'academic',
      '/students/' || NEW.student_id
    FROM user_roles ur
    WHERE ur.role IN ('admin', 'reception');
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Trigger
DROP TRIGGER IF EXISTS trg_issue_certificate_on_pass ON public.level_grades;
CREATE TRIGGER trg_issue_certificate_on_pass
AFTER INSERT OR UPDATE OF outcome ON public.level_grades
FOR EACH ROW
EXECUTE FUNCTION public.issue_certificate_on_pass();

-- 3. Backfill pending certs
INSERT INTO student_certificates (
  student_id, level_id, group_id, status,
  student_name_snapshot, level_name_snapshot
)
SELECT
  lg.student_id, lg.level_id, lg.group_id, 'pending',
  COALESCE(p.full_name, 'Unknown'),
  COALESCE(l.name, 'Unknown')
FROM level_grades lg
LEFT JOIN profiles p ON p.user_id = lg.student_id
LEFT JOIN levels l ON l.id = lg.level_id
WHERE lg.outcome = 'passed'
ON CONFLICT (student_id, level_id) DO NOTHING;

-- 4. Backfill notifications for newly-created pending certs
INSERT INTO notifications (user_id, title, title_ar, message, message_ar, type, category, action_url)
SELECT
  ur.user_id,
  'Certificate Ready to Print',
  'شهادة جاهزة للطباعة',
  COALESCE(p.full_name, 'Student') || ' — ' || COALESCE(l.name, 'Level') || ' certificate pending generation',
  COALESCE(p.full_name, 'طالب') || ' — شهادة ' || COALESCE(l.name, 'المستوى') || ' في انتظار التوليد',
  'info',
  'academic',
  '/students/' || sc.student_id
FROM student_certificates sc
JOIN user_roles ur ON ur.role IN ('admin', 'reception')
LEFT JOIN profiles p ON p.user_id = sc.student_id
LEFT JOIN levels l ON l.id = sc.level_id
WHERE sc.status = 'pending'
  AND sc.created_at >= now() - interval '2 minutes'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.user_id = ur.user_id
      AND n.action_url = '/students/' || sc.student_id
      AND n.title = 'Certificate Ready to Print'
      AND n.created_at >= now() - interval '1 day'
  );
