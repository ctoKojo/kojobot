
-- ============================================================================
-- ROOT-CAUSE FIX: sessions.level_id must NEVER be NULL
-- ============================================================================
-- Background:
--   Legacy sessions (created before session-level binding was enforced) had
--   level_id = NULL. This broke attendance counting, level progression, and
--   final exam scheduling because all those queries filter by s.level_id.
--
-- Strategy:
--   1. Backfill: copy group.level_id into all NULL session.level_id rows.
--   2. BEFORE INSERT trigger: auto-set level_id from group if not provided.
--   3. BEFORE UPDATE trigger: forbid setting status to completed/in_progress
--      while level_id is NULL; auto-fill from group as a safety net.
-- ============================================================================

-- STEP 1: Backfill existing NULL rows
UPDATE public.sessions s
SET level_id = g.level_id
FROM public.groups g
WHERE s.group_id = g.id
  AND s.level_id IS NULL
  AND g.level_id IS NOT NULL;

-- STEP 2: Trigger function — auto-set level_id on INSERT or UPDATE
CREATE OR REPLACE FUNCTION public.ensure_session_level_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_level_id UUID;
BEGIN
  -- If level_id is already set, nothing to do
  IF NEW.level_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Try to derive from group
  SELECT level_id INTO v_group_level_id
  FROM public.groups
  WHERE id = NEW.group_id;

  IF v_group_level_id IS NOT NULL THEN
    NEW.level_id := v_group_level_id;
    RETURN NEW;
  END IF;

  -- Group has no level either — only allow if session is being cancelled
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Session must have a level_id (group %, session %). Cannot save without a level.',
    NEW.group_id, COALESCE(NEW.id::text, '<new>')
    USING ERRCODE = 'check_violation';
END;
$$;

-- STEP 3: Drop old triggers if exist + create unified trigger
DROP TRIGGER IF EXISTS auto_set_session_level_on_insert ON public.sessions;
DROP TRIGGER IF EXISTS enforce_session_level_on_complete ON public.sessions;
DROP TRIGGER IF EXISTS ensure_session_level_id_trg ON public.sessions;

CREATE TRIGGER ensure_session_level_id_trg
  BEFORE INSERT OR UPDATE OF level_id, status, group_id ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_session_level_id();

-- STEP 4: Verify backfill — raise notice with remaining NULL count
DO $$
DECLARE
  v_remaining INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_remaining
  FROM public.sessions
  WHERE level_id IS NULL AND status IN ('completed', 'in_progress', 'scheduled');
  
  IF v_remaining > 0 THEN
    RAISE WARNING 'Still % sessions with NULL level_id (non-cancelled). Their groups also lack level_id.', v_remaining;
  ELSE
    RAISE NOTICE 'Backfill complete. All active sessions have level_id set.';
  END IF;
END $$;
