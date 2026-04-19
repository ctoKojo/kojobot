-- Fix search_path on prevent_snapshot_modification
CREATE OR REPLACE FUNCTION public.prevent_snapshot_modification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'SNAPSHOT_IMMUTABLE: Financial snapshots cannot be modified or deleted (id=%)', 
    COALESCE(OLD.id, NEW.id);
END;
$$;