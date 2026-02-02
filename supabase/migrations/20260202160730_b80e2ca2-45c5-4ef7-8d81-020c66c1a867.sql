-- Update the create_group_sessions function to create ALL 12 sessions
-- Sessions before starting_session_number will be marked as 'completed'
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
  
  -- Create all 12 sessions
  FOR i IN 1..12 LOOP
    -- Calculate session date based on position relative to starting_num
    IF i < starting_num THEN
      -- Sessions before starting point: calculate backwards from start_date
      session_date_calc := start_date - ((starting_num - i) * 7);
      session_status := 'completed';
    ELSE
      -- Sessions from starting point onwards: calculate forwards
      session_date_calc := start_date + ((i - starting_num) * 7);
      session_status := 'scheduled';
    END IF;
    
    INSERT INTO public.sessions (group_id, session_date, session_time, duration_minutes, status, session_number)
    VALUES (NEW.id, session_date_calc, NEW.schedule_time, NEW.duration_minutes, session_status, i);
  END LOOP;
  
  RETURN NEW;
END;
$function$;