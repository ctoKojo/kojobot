-- Add column for starting session number
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS starting_session_number integer DEFAULT 1;

-- Update the create_group_sessions trigger to support starting from a specific session
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
  
  -- Create sessions from starting_num to 12
  FOR i IN starting_num..12 LOOP
    INSERT INTO public.sessions (group_id, session_date, session_time, duration_minutes, status, session_number)
    VALUES (NEW.id, start_date + ((i - starting_num) * 7), NEW.schedule_time, NEW.duration_minutes, 'scheduled', i);
  END LOOP;
  
  RETURN NEW;
END;
$function$;