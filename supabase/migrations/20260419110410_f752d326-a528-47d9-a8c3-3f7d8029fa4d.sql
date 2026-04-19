
-- Replace the trigger to fire on both INSERT and UPDATE,
-- and to also notify the student + linked parents.
CREATE OR REPLACE FUNCTION public.notify_renewal_on_level_pass()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_student_name text;
  v_level_name text;
  v_level_name_ar text;
  v_next_level_name text;
  v_next_level_name_ar text;
  v_should_fire boolean := false;
BEGIN
  -- Fire when outcome becomes 'passed' (insert OR update transition)
  IF TG_OP = 'INSERT' THEN
    v_should_fire := (NEW.outcome = 'passed');
  ELSIF TG_OP = 'UPDATE' THEN
    v_should_fire := (NEW.outcome = 'passed' AND (OLD.outcome IS NULL OR OLD.outcome <> 'passed'));
  END IF;

  IF NOT v_should_fire THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_student_name FROM profiles WHERE user_id = NEW.student_id;
  SELECT name, name_ar INTO v_level_name, v_level_name_ar FROM levels WHERE id = NEW.current_level_id;

  SELECT name, name_ar INTO v_next_level_name, v_next_level_name_ar
  FROM levels
  WHERE level_order > (SELECT level_order FROM levels WHERE id = NEW.current_level_id)
    AND is_active = true
  ORDER BY level_order ASC
  LIMIT 1;

  -- Notify admins + reception
  INSERT INTO notifications (user_id, title, title_ar, message, message_ar, type, category, action_url)
  SELECT
    ur.user_id,
    'Subscription Renewal Needed',
    'تجديد اشتراك مطلوب',
    format('%s has passed %s and needs a subscription renewal for %s',
      v_student_name, v_level_name, COALESCE(v_next_level_name, 'next level')),
    format('%s اجتاز %s ومحتاج تجديد اشتراك لـ %s',
      v_student_name, v_level_name_ar, COALESCE(v_next_level_name_ar, 'المستوى التالي')),
    'renewal_needed',
    'academic',
    format('/students/%s', NEW.student_id)
  FROM user_roles ur
  WHERE ur.role IN ('admin', 'reception');

  -- Notify the student
  INSERT INTO notifications (user_id, title, title_ar, message, message_ar, type, category, action_url)
  VALUES (
    NEW.student_id,
    'Congratulations! Level Passed',
    'مبروك! نجحت في المستوى',
    format('You have successfully passed %s. Please renew your subscription to continue.',
      COALESCE(v_level_name, 'this level')),
    format('مبروك، نجحت في %s. برجاء تجديد الاشتراك للاستمرار.',
      COALESCE(v_level_name_ar, 'هذا المستوى')),
    'success',
    'academic',
    '/dashboard'
  );

  -- Mirror to linked parents
  INSERT INTO notifications (user_id, title, title_ar, message, message_ar, type, category, action_url)
  SELECT
    ps.parent_id,
    'Your Child Passed a Level',
    'ابنك نجح في مستوى',
    format('%s has successfully passed %s. Please renew the subscription to continue.',
      v_student_name, COALESCE(v_level_name, 'a level')),
    format('%s نجح في %s. برجاء تجديد الاشتراك للاستمرار.',
      v_student_name, COALESCE(v_level_name_ar, 'مستوى')),
    'success',
    'academic',
    format('/parent/student/%s', NEW.student_id)
  FROM parent_students ps
  WHERE ps.student_id = NEW.student_id;

  RETURN NEW;
END;
$function$;

-- Recreate trigger to also include INSERT
DROP TRIGGER IF EXISTS trg_notify_renewal_on_level_pass ON public.group_student_progress;
CREATE TRIGGER trg_notify_renewal_on_level_pass
  AFTER INSERT OR UPDATE ON public.group_student_progress
  FOR EACH ROW EXECUTE FUNCTION notify_renewal_on_level_pass();
