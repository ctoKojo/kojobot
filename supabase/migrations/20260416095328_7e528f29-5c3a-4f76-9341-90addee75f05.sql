
-- Fix the trigger: when content_number is already assigned, still update last_delivered_content_number
CREATE OR REPLACE FUNCTION assign_content_number_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_content INTEGER;
  v_owed INTEGER;
  v_has_present BOOLEAN;
  v_expected INTEGER;
  v_existing_content INTEGER;
BEGIN
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Check if content_number is already assigned
  SELECT content_number INTO v_existing_content FROM sessions WHERE id = NEW.id;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.group_id::text));

  SELECT last_delivered_content_number, owed_sessions_count
  INTO v_last_content, v_owed
  FROM groups
  WHERE id = NEW.group_id
  FOR UPDATE;

  SELECT COALESCE(l.expected_sessions_count, 12) INTO v_expected
  FROM levels l JOIN groups g ON g.level_id = l.id WHERE g.id = NEW.group_id;
  v_expected := COALESCE(v_expected, 12);

  -- If content_number already set, just sync last_delivered_content_number and return
  IF v_existing_content IS NOT NULL THEN
    IF v_existing_content > v_last_content THEN
      IF NEW.is_makeup IS TRUE THEN
        UPDATE groups
        SET last_delivered_content_number = v_existing_content,
            owed_sessions_count = GREATEST(0, COALESCE(v_owed, 0) - 1)
        WHERE id = NEW.group_id;
      ELSE
        UPDATE groups
        SET last_delivered_content_number = v_existing_content
        WHERE id = NEW.group_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Original logic for sessions without content_number
  SELECT EXISTS (
    SELECT 1 FROM attendance a WHERE a.session_id = NEW.id AND a.status = 'present'
  ) INTO v_has_present;

  IF v_has_present THEN
    UPDATE sessions
    SET content_number = LEAST(v_last_content + 1, v_expected)
    WHERE id = NEW.id;

    IF NEW.is_makeup IS TRUE THEN
      UPDATE groups
      SET last_delivered_content_number = LEAST(v_last_content + 1, v_expected),
          owed_sessions_count = GREATEST(0, COALESCE(v_owed, 0) - 1)
      WHERE id = NEW.group_id;
    ELSE
      UPDATE groups
      SET last_delivered_content_number = LEAST(v_last_content + 1, v_expected)
      WHERE id = NEW.group_id;
    END IF;
  ELSE
    UPDATE sessions
    SET content_number = v_last_content
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Fix existing data: sync last_delivered_content_number for all active groups
UPDATE groups g
SET last_delivered_content_number = sub.actual_max
FROM (
  SELECT s.group_id, MAX(s.content_number) as actual_max
  FROM sessions s
  WHERE s.status = 'completed'
    AND s.content_number IS NOT NULL
    AND s.content_number >= 1
  GROUP BY s.group_id
) sub
WHERE g.id = sub.group_id
  AND g.is_active = true
  AND g.last_delivered_content_number < sub.actual_max;
