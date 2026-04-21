
-- Bypass DML guards for this migration only
SET LOCAL app.via_rpc = 'true';

-- ============================================================
-- PART B: Duration NOT NULL + CHECK constraint
-- ============================================================
UPDATE public.sessions SET duration_minutes = 60 WHERE duration_minutes IS NULL;
ALTER TABLE public.sessions ALTER COLUMN duration_minutes SET NOT NULL;
ALTER TABLE public.sessions ALTER COLUMN duration_minutes SET DEFAULT 60;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_duration_positive') THEN
    ALTER TABLE public.sessions ADD CONSTRAINT sessions_duration_positive
      CHECK (duration_minutes > 0 AND duration_minutes <= 480);
  END IF;
END $$;

-- ============================================================
-- PART C: start_at / end_at via TRIGGER (Cairo = UTC + 3h)
-- ============================================================
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.compute_session_time_bounds()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_local TIMESTAMP;
BEGIN
  IF NEW.session_date IS NULL OR NEW.session_time IS NULL THEN RETURN NEW; END IF;
  v_local := (NEW.session_date::text || ' ' || NEW.session_time::text)::timestamp;
  NEW.start_at := (v_local - INTERVAL '3 hours') AT TIME ZONE 'UTC';
  NEW.end_at := NEW.start_at + (COALESCE(NEW.duration_minutes, 60) || ' minutes')::interval;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_02_compute_session_time_bounds ON public.sessions;
CREATE TRIGGER trg_02_compute_session_time_bounds
  BEFORE INSERT OR UPDATE OF session_date, session_time, duration_minutes
  ON public.sessions FOR EACH ROW
  EXECUTE FUNCTION public.compute_session_time_bounds();

UPDATE public.sessions
SET start_at = ((session_date::text || ' ' || session_time::text)::timestamp - INTERVAL '3 hours') AT TIME ZONE 'UTC',
    end_at   = ((session_date::text || ' ' || session_time::text)::timestamp - INTERVAL '3 hours') AT TIME ZONE 'UTC'
             + (COALESCE(duration_minutes, 60) || ' minutes')::interval
WHERE start_at IS NULL OR end_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_end_at ON public.sessions(end_at);
CREATE INDEX IF NOT EXISTS idx_sessions_scan_window
  ON public.sessions(end_at, status) WHERE status = 'completed';

-- ============================================================
-- PART A: Makeup integrity trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_makeup_session_integrity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_orig RECORD;
BEGIN
  IF NEW.is_makeup IS NOT TRUE THEN RETURN NEW; END IF;
  IF NEW.makeup_session_id IS NULL THEN
    RAISE EXCEPTION 'MAKEUP_MISSING_REFERENCE'; END IF;
  SELECT s.level_id, s.content_number INTO v_orig
  FROM public.makeup_sessions m
  JOIN public.sessions s ON s.id = m.original_session_id
  WHERE m.id = NEW.makeup_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MAKEUP_ORIGINAL_NOT_FOUND'; END IF;
  NEW.level_id := COALESCE(NEW.level_id, v_orig.level_id);
  NEW.content_number := COALESCE(NEW.content_number, v_orig.content_number);
  IF NEW.level_id IS NULL OR NEW.content_number IS NULL THEN
    RAISE EXCEPTION 'MAKEUP_ORIGINAL_INCOMPLETE'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_01_enforce_makeup_integrity ON public.sessions;
DROP TRIGGER IF EXISTS enforce_makeup_session_integrity_trigger ON public.sessions;
CREATE TRIGGER trg_01_enforce_makeup_integrity
  BEFORE INSERT OR UPDATE ON public.sessions FOR EACH ROW
  EXECUTE FUNCTION public.enforce_makeup_session_integrity();

-- ============================================================
-- PART D: Idempotency on instructor_warnings + traceability
-- ============================================================
ALTER TABLE public.instructor_warnings
  ADD COLUMN IF NOT EXISTS resolution_reason TEXT,
  ADD COLUMN IF NOT EXISTS settings_version INTEGER,
  ADD COLUMN IF NOT EXISTS trace_id UUID;

DROP INDEX IF EXISTS public.idx_warnings_active_dedup;
CREATE UNIQUE INDEX idx_warnings_active_dedup
  ON public.instructor_warnings(session_id, warning_type, instructor_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_warnings_trace
  ON public.instructor_warnings(trace_id) WHERE trace_id IS NOT NULL;

-- ============================================================
-- PART F: data_quality_issues - daily dedup via stored DATE column
-- ============================================================
ALTER TABLE public.data_quality_issues
  ADD COLUMN IF NOT EXISTS detected_date DATE;

CREATE OR REPLACE FUNCTION public.set_dq_detected_date()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.detected_date := (COALESCE(NEW.detected_at, now()) AT TIME ZONE 'UTC')::date;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dq_set_detected_date ON public.data_quality_issues;
CREATE TRIGGER trg_dq_set_detected_date
  BEFORE INSERT OR UPDATE OF detected_at
  ON public.data_quality_issues FOR EACH ROW
  EXECUTE FUNCTION public.set_dq_detected_date();

UPDATE public.data_quality_issues
SET detected_date = (detected_at AT TIME ZONE 'UTC')::date
WHERE detected_date IS NULL;

DROP INDEX IF EXISTS public.idx_dq_issues_dedup_daily;
CREATE UNIQUE INDEX idx_dq_issues_dedup_daily
  ON public.data_quality_issues(entity_id, issue_type, detected_date);

CREATE INDEX IF NOT EXISTS idx_dq_issues_type_time
  ON public.data_quality_issues(issue_type, detected_at DESC);

-- ============================================================
-- PART G: activity_logs trace_id + request_id
-- ============================================================
ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS trace_id UUID,
  ADD COLUMN IF NOT EXISTS request_id TEXT;

CREATE INDEX IF NOT EXISTS idx_activity_logs_trace
  ON public.activity_logs(trace_id) WHERE trace_id IS NOT NULL;

-- ============================================================
-- PART H: system_settings - compliance_grace_periods
-- ============================================================
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_by UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='system_settings'
      AND policyname='system_settings_select_admin_reception'
  ) THEN
    CREATE POLICY system_settings_select_admin_reception
      ON public.system_settings FOR SELECT
      USING (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'reception'::public.app_role)
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='system_settings'
      AND policyname='system_settings_modify_admin_only'
  ) THEN
    CREATE POLICY system_settings_modify_admin_only
      ON public.system_settings FOR ALL
      USING (public.has_role(auth.uid(), 'admin'::public.app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

INSERT INTO public.system_settings (key, value, version)
VALUES (
  'compliance_grace_periods',
  '{"attendance_minutes": 60, "quiz_hours": 24, "assignment_hours": 24, "evaluation_hours": 24, "makeup_multiplier": 1.5}'::jsonb,
  1
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.validate_grace_settings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v JSONB; v_att INT; v_qz INT; v_as INT; v_ev INT; v_mul NUMERIC;
BEGIN
  IF NEW.key <> 'compliance_grace_periods' THEN RETURN NEW; END IF;
  v := NEW.value;
  v_att := (v->>'attendance_minutes')::INT;
  v_qz  := (v->>'quiz_hours')::INT;
  v_as  := (v->>'assignment_hours')::INT;
  v_ev  := (v->>'evaluation_hours')::INT;
  v_mul := (v->>'makeup_multiplier')::NUMERIC;
  IF v_att IS NULL OR v_att < 0 OR v_att > 180 THEN
    RAISE EXCEPTION 'attendance_minutes must be 0..180, got %', v_att; END IF;
  IF v_qz IS NULL OR v_qz < 1 OR v_qz > 72 THEN
    RAISE EXCEPTION 'quiz_hours must be 1..72, got %', v_qz; END IF;
  IF v_as IS NULL OR v_as < 1 OR v_as > 72 THEN
    RAISE EXCEPTION 'assignment_hours must be 1..72, got %', v_as; END IF;
  IF v_ev IS NULL OR v_ev < 1 OR v_ev > 72 THEN
    RAISE EXCEPTION 'evaluation_hours must be 1..72, got %', v_ev; END IF;
  IF v_mul IS NULL OR v_mul < 1.0 OR v_mul > 3.0 THEN
    RAISE EXCEPTION 'makeup_multiplier must be 1.0..3.0, got %', v_mul; END IF;
  IF TG_OP = 'UPDATE' AND OLD.value IS DISTINCT FROM NEW.value THEN
    NEW.version := COALESCE(OLD.version, 0) + 1;
    NEW.updated_at := now();
    NEW.updated_by := COALESCE(NEW.updated_by, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_grace_settings ON public.system_settings;
CREATE TRIGGER trg_validate_grace_settings
  BEFORE INSERT OR UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.validate_grace_settings();

CREATE OR REPLACE FUNCTION public.audit_grace_settings_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_trace UUID := gen_random_uuid();
BEGIN
  IF NEW.key <> 'compliance_grace_periods' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.value IS NOT DISTINCT FROM NEW.value THEN RETURN NEW; END IF;
  INSERT INTO public.activity_logs (
    user_id, action, entity_type, entity_id, details, trace_id
  ) VALUES (
    COALESCE(auth.uid(), NEW.updated_by, '00000000-0000-0000-0000-000000000000'::uuid),
    CASE WHEN TG_OP = 'INSERT' THEN 'create_setting' ELSE 'update_setting' END,
    'system_settings', NEW.key,
    jsonb_build_object(
      'old_value', CASE WHEN TG_OP='UPDATE' THEN OLD.value ELSE NULL END,
      'new_value', NEW.value,
      'old_version', CASE WHEN TG_OP='UPDATE' THEN OLD.version ELSE NULL END,
      'new_version', NEW.version
    ),
    v_trace
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_grace_settings ON public.system_settings;
CREATE TRIGGER trg_audit_grace_settings
  AFTER INSERT OR UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_grace_settings_change();

-- ============================================================
-- PART I: Performance indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sessions_makeup_id
  ON public.sessions(makeup_session_id) WHERE is_makeup = true;
CREATE INDEX IF NOT EXISTS idx_makeup_assigned_inst
  ON public.makeup_sessions(assigned_instructor_id)
  WHERE assigned_instructor_id IS NOT NULL;

-- ============================================================
-- PART J: log_dq_issue RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_dq_issue(
  p_entity_table TEXT,
  p_entity_id UUID,
  p_issue_type public.data_quality_issue_type,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(inserted BOOLEAN, issue_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  PERFORM set_config('app.via_rpc', 'true', true);
  INSERT INTO public.data_quality_issues (entity_table, entity_id, issue_type, details)
  VALUES (p_entity_table, p_entity_id, p_issue_type, COALESCE(p_details, '{}'::jsonb))
  ON CONFLICT (entity_id, issue_type, detected_date) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    RETURN QUERY SELECT false AS inserted, NULL::UUID AS issue_id;
  ELSE
    RETURN QUERY SELECT true AS inserted, v_id AS issue_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_dq_issue(TEXT, UUID, public.data_quality_issue_type, JSONB) TO authenticated, service_role;
