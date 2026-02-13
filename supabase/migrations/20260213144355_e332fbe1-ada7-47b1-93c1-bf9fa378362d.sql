
-- 1. Create auto_generate_next_session trigger function
CREATE OR REPLACE FUNCTION public.auto_generate_next_session()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  next_session_number integer;
  next_session_date date;
  group_record RECORD;
  existing_next RECORD;
BEGIN
  -- Only trigger when status changes to 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Check session_number exists and is less than 12
    IF NEW.session_number IS NULL OR NEW.session_number >= 12 THEN
      RETURN NEW;
    END IF;

    next_session_number := NEW.session_number + 1;

    -- Check if next session already exists
    SELECT id INTO existing_next
    FROM public.sessions
    WHERE group_id = NEW.group_id AND session_number = next_session_number
    LIMIT 1;

    IF existing_next.id IS NOT NULL THEN
      RETURN NEW;
    END IF;

    -- Check if group is still active
    SELECT is_active, schedule_time, duration_minutes INTO group_record
    FROM public.groups
    WHERE id = NEW.group_id;

    IF NOT group_record.is_active THEN
      RETURN NEW;
    END IF;

    -- Calculate next session date (current session date + 7 days)
    next_session_date := NEW.session_date + 7;

    -- Insert the next session
    INSERT INTO public.sessions (
      group_id, session_date, session_time, duration_minutes, status, session_number
    ) VALUES (
      NEW.group_id, next_session_date, group_record.schedule_time, group_record.duration_minutes, 'scheduled', next_session_number
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Create the trigger
CREATE TRIGGER on_session_completed
  AFTER UPDATE ON public.sessions
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.auto_generate_next_session();

-- 3. Modify create_group_sessions to only generate up to starting_session_number
CREATE OR REPLACE FUNCTION public.create_group_sessions()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  day_map jsonb := '{"Sunday":0,"Monday":1,"Tuesday":2,"Wednesday":3,"Thursday":4,"Friday":5,"Saturday":6}';
  target_day integer;
  start_date date;
  starting_num integer;
  i integer;
  session_status text;
  session_date_calc date;
BEGIN
  -- Only create sessions for active groups
  IF NOT NEW.is_active THEN
    RETURN NEW;
  END IF;
  
  -- Get target day number (0 = Sunday)
  target_day := (day_map ->> NEW.schedule_day)::integer;
  
  -- Get starting session number (default 1)
  starting_num := COALESCE(NEW.starting_session_number, 1);
  
  -- Use custom start_date if provided, otherwise find next occurrence
  IF NEW.start_date IS NOT NULL THEN
    start_date := NEW.start_date;
  ELSE
    -- Find the next occurrence of the target day
    start_date := CURRENT_DATE;
    WHILE EXTRACT(DOW FROM start_date) != target_day LOOP
      start_date := start_date + 1;
    END LOOP;
  END IF;
  
  -- Create sessions only up to starting_session_number (not all 12)
  FOR i IN 1..starting_num LOOP
    -- Calculate session date based on position relative to starting_num
    IF i < starting_num THEN
      -- Sessions before starting point: calculate backwards from start_date
      session_date_calc := start_date - ((starting_num - i) * 7);
      session_status := 'completed';
    ELSE
      -- The starting session itself
      session_date_calc := start_date;
      session_status := 'scheduled';
    END IF;
    
    INSERT INTO public.sessions (group_id, session_date, session_time, duration_minutes, status, session_number)
    VALUES (NEW.id, session_date_calc, NEW.schedule_time, NEW.duration_minutes, session_status, i);
  END LOOP;
  
  RETURN NEW;
END;
$function$;
