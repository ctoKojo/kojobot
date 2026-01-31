-- Function 1: إنشاء 12 سيشن تلقائياً عند إضافة جروب جديد
CREATE OR REPLACE FUNCTION public.create_group_sessions()
RETURNS TRIGGER AS $$
DECLARE
  day_map jsonb := '{"Sunday":0,"Monday":1,"Tuesday":2,"Wednesday":3,"Thursday":4,"Friday":5,"Saturday":6}';
  target_day integer;
  start_date date;
  i integer;
BEGIN
  -- Only create sessions for active groups
  IF NOT NEW.is_active THEN
    RETURN NEW;
  END IF;
  
  -- Get target day number (0 = Sunday)
  target_day := (day_map ->> NEW.schedule_day)::integer;
  
  -- Find the next occurrence of the target day
  start_date := CURRENT_DATE;
  WHILE EXTRACT(DOW FROM start_date) != target_day LOOP
    start_date := start_date + 1;
  END LOOP;
  
  -- Create 12 sessions (one per week)
  FOR i IN 1..12 LOOP
    INSERT INTO public.sessions (group_id, session_date, session_time, duration_minutes, status, session_number)
    VALUES (NEW.id, start_date + ((i-1) * 7), NEW.schedule_time, NEW.duration_minutes, 'scheduled', i);
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger: After inserting a new group
DROP TRIGGER IF EXISTS trigger_create_group_sessions ON public.groups;
CREATE TRIGGER trigger_create_group_sessions
AFTER INSERT ON public.groups
FOR EACH ROW
EXECUTE FUNCTION public.create_group_sessions();

-- Function 2: تحديث السيشنات المستقبلية عند تغيير جدول الجروب
CREATE OR REPLACE FUNCTION public.update_future_sessions()
RETURNS TRIGGER AS $$
DECLARE
  day_map jsonb := '{"Sunday":0,"Monday":1,"Tuesday":2,"Wednesday":3,"Thursday":4,"Friday":5,"Saturday":6}';
  target_day integer;
  start_date date;
  session_record RECORD;
  new_date date;
BEGIN
  -- Only proceed if schedule actually changed
  IF OLD.schedule_day = NEW.schedule_day 
     AND OLD.schedule_time = NEW.schedule_time 
     AND OLD.duration_minutes = NEW.duration_minutes THEN
    RETURN NEW;
  END IF;
  
  -- Get new target day number
  target_day := (day_map ->> NEW.schedule_day)::integer;
  
  -- Find the next occurrence of the new target day
  start_date := CURRENT_DATE;
  WHILE EXTRACT(DOW FROM start_date) != target_day LOOP
    start_date := start_date + 1;
  END LOOP;
  
  -- Update only future scheduled sessions
  FOR session_record IN 
    SELECT id, session_number FROM public.sessions 
    WHERE group_id = NEW.id 
      AND status = 'scheduled'
      AND session_date >= CURRENT_DATE
    ORDER BY session_number
  LOOP
    -- Calculate new date based on session_number
    new_date := start_date + ((session_record.session_number - 1) * 7);
    
    UPDATE public.sessions 
    SET session_date = new_date,
        session_time = NEW.schedule_time,
        duration_minutes = NEW.duration_minutes,
        updated_at = now()
    WHERE id = session_record.id;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger: After updating group schedule
DROP TRIGGER IF EXISTS trigger_update_group_sessions ON public.groups;
CREATE TRIGGER trigger_update_group_sessions
AFTER UPDATE OF schedule_day, schedule_time, duration_minutes ON public.groups
FOR EACH ROW
EXECUTE FUNCTION public.update_future_sessions();

-- Backfill: إكمال السيشنات الناقصة للمجموعات الموجودة
DO $$
DECLARE
  group_record RECORD;
  current_max integer;
  target_day integer;
  start_date date;
  day_map jsonb := '{"Sunday":0,"Monday":1,"Tuesday":2,"Wednesday":3,"Thursday":4,"Friday":5,"Saturday":6}';
  i integer;
BEGIN
  FOR group_record IN SELECT * FROM public.groups WHERE is_active = true LOOP
    -- Get current max session_number for this group
    SELECT COALESCE(MAX(session_number), 0) INTO current_max 
    FROM public.sessions WHERE group_id = group_record.id;
    
    -- If less than 12 sessions, create the remaining ones
    IF current_max < 12 THEN
      target_day := (day_map ->> group_record.schedule_day)::integer;
      
      -- Find next occurrence of target day
      start_date := CURRENT_DATE;
      WHILE EXTRACT(DOW FROM start_date) != target_day LOOP
        start_date := start_date + 1;
      END LOOP;
      
      -- Create missing sessions
      FOR i IN (current_max + 1)..12 LOOP
        INSERT INTO public.sessions (group_id, session_date, session_time, duration_minutes, status, session_number)
        VALUES (
          group_record.id, 
          start_date + ((i - current_max - 1) * 7), 
          group_record.schedule_time, 
          group_record.duration_minutes, 
          'scheduled', 
          i
        );
      END LOOP;
    END IF;
  END LOOP;
END $$;