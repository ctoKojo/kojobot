
-- 1. Add level_id to subscriptions
ALTER TABLE public.subscriptions 
ADD COLUMN level_id uuid REFERENCES public.levels(id);

-- Index for efficient queries
CREATE INDEX idx_subscriptions_level_id ON public.subscriptions(level_id);

-- 2. Backfill existing subscriptions with student's current level_id from profiles
UPDATE public.subscriptions s
SET level_id = p.level_id
FROM public.profiles p
WHERE p.user_id = s.student_id
  AND s.level_id IS NULL
  AND p.level_id IS NOT NULL;

-- 3. Create trigger function to notify admin/reception when student passes a level
CREATE OR REPLACE FUNCTION public.notify_renewal_on_level_pass()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_name text;
  v_level_name text;
  v_level_name_ar text;
  v_next_level_name text;
  v_next_level_name_ar text;
  v_admin_id uuid;
  v_reception_id uuid;
BEGIN
  -- Only fire when outcome changes to 'passed'
  IF NEW.outcome = 'passed' AND (OLD.outcome IS NULL OR OLD.outcome <> 'passed') THEN
    -- Get student name
    SELECT full_name INTO v_student_name
    FROM profiles WHERE user_id = NEW.student_id;

    -- Get current level name
    SELECT name, name_ar INTO v_level_name, v_level_name_ar
    FROM levels WHERE id = NEW.current_level_id;

    -- Get next level (by level_order)
    SELECT name, name_ar INTO v_next_level_name, v_next_level_name_ar
    FROM levels
    WHERE level_order > (SELECT level_order FROM levels WHERE id = NEW.current_level_id)
      AND is_active = true
    ORDER BY level_order ASC
    LIMIT 1;

    -- Notify all admins
    FOR v_admin_id IN
      SELECT user_id FROM user_roles WHERE role = 'admin'
    LOOP
      INSERT INTO notifications (user_id, title, title_ar, message, message_ar, type, category, action_url)
      VALUES (
        v_admin_id,
        'Subscription Renewal Needed',
        'تجديد اشتراك مطلوب',
        format('%s has passed %s and needs a subscription renewal for %s',
          v_student_name, v_level_name, COALESCE(v_next_level_name, 'next level')),
        format('%s اجتاز %s ومحتاج تجديد اشتراك لـ %s',
          v_student_name, v_level_name_ar, COALESCE(v_next_level_name_ar, 'المستوى التالي')),
        'renewal_needed',
        'academic',
        format('/students/%s', NEW.student_id)
      );
    END LOOP;

    -- Notify all reception staff
    FOR v_reception_id IN
      SELECT user_id FROM user_roles WHERE role = 'reception'
    LOOP
      INSERT INTO notifications (user_id, title, title_ar, message, message_ar, type, category, action_url)
      VALUES (
        v_reception_id,
        'Subscription Renewal Needed',
        'تجديد اشتراك مطلوب',
        format('%s has passed %s and needs a subscription renewal for %s',
          v_student_name, v_level_name, COALESCE(v_next_level_name, 'next level')),
        format('%s اجتاز %s ومحتاج تجديد اشتراك لـ %s',
          v_student_name, v_level_name_ar, COALESCE(v_next_level_name_ar, 'المستوى التالي')),
        'renewal_needed',
        'academic',
        format('/students/%s', NEW.student_id)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Attach trigger
DROP TRIGGER IF EXISTS trg_notify_renewal_on_level_pass ON public.group_student_progress;
CREATE TRIGGER trg_notify_renewal_on_level_pass
  AFTER UPDATE ON public.group_student_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_renewal_on_level_pass();
