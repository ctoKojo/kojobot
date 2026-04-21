-- 1) Add level_id and content_number columns to instructor_warnings (nullable, populated by edge function)
ALTER TABLE public.instructor_warnings
  ADD COLUMN IF NOT EXISTS level_id uuid,
  ADD COLUMN IF NOT EXISTS content_number integer;

-- 2) Generated fingerprint column (deterministic SHA-256 of canonical key)
-- Uses MD5 (immutable, built-in) on a canonical concatenation
ALTER TABLE public.instructor_warnings
  ADD COLUMN IF NOT EXISTS warning_fingerprint text
  GENERATED ALWAYS AS (
    md5(
      coalesce(session_id::text, '') || '|' ||
      coalesce(warning_type, '')      || '|' ||
      coalesce(instructor_id::text, '') || '|' ||
      coalesce(level_id::text, '')    || '|' ||
      coalesce(content_number::text, '')
    )
  ) STORED;

-- 3) Backfill level_id/content_number from sessions for existing rows
UPDATE public.instructor_warnings w
SET level_id = s.level_id,
    content_number = s.content_number
FROM public.sessions s
WHERE w.session_id = s.id
  AND (w.level_id IS NULL OR w.content_number IS NULL);

-- 4) Unique partial index — only enforce on active warnings to allow re-issuing after resolve
CREATE UNIQUE INDEX IF NOT EXISTS idx_warnings_fingerprint_active
  ON public.instructor_warnings(warning_fingerprint)
  WHERE is_active = true;

-- 5) Index for fast lookups by fingerprint regardless of active state (audit trail)
CREATE INDEX IF NOT EXISTS idx_warnings_fingerprint_all
  ON public.instructor_warnings(warning_fingerprint);

-- 6) Audit table for duplicate attempts (visible to admins)
CREATE TABLE IF NOT EXISTS public.warning_dedup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempted_at timestamptz NOT NULL DEFAULT now(),
  trace_id uuid,
  fingerprint text NOT NULL,
  existing_warning_id uuid REFERENCES public.instructor_warnings(id) ON DELETE SET NULL,
  attempted_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL DEFAULT 'fingerprint_collision'
);

CREATE INDEX IF NOT EXISTS idx_warning_dedup_log_trace ON public.warning_dedup_log(trace_id);
CREATE INDEX IF NOT EXISTS idx_warning_dedup_log_fp ON public.warning_dedup_log(fingerprint);
CREATE INDEX IF NOT EXISTS idx_warning_dedup_log_time ON public.warning_dedup_log(attempted_at DESC);

ALTER TABLE public.warning_dedup_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/reception view dedup log"
  ON public.warning_dedup_log FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'reception'::app_role)
  );

CREATE POLICY "Service role insert dedup log"
  ON public.warning_dedup_log FOR INSERT
  WITH CHECK (true);

-- 7) RPC: insert warning with fingerprint check (deterministic, returns inserted flag)
CREATE OR REPLACE FUNCTION public.insert_warning_deduped(
  p_session_id uuid,
  p_instructor_id uuid,
  p_warning_type text,
  p_reason text,
  p_reason_ar text,
  p_severity text,
  p_issued_by uuid,
  p_settings_version integer,
  p_trace_id uuid,
  p_level_id uuid DEFAULT NULL,
  p_content_number integer DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_reference_type text DEFAULT NULL
)
RETURNS TABLE(inserted boolean, warning_id uuid, fingerprint text, existing_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fp text;
  v_existing_id uuid;
  v_new_id uuid;
BEGIN
  -- Compute fingerprint identical to generated column
  v_fp := md5(
    coalesce(p_session_id::text, '') || '|' ||
    coalesce(p_warning_type, '') || '|' ||
    coalesce(p_instructor_id::text, '') || '|' ||
    coalesce(p_level_id::text, '') || '|' ||
    coalesce(p_content_number::text, '')
  );

  -- Check for existing active warning with same fingerprint
  SELECT id INTO v_existing_id
  FROM public.instructor_warnings
  WHERE warning_fingerprint = v_fp
    AND is_active = true
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Log duplicate attempt
    INSERT INTO public.warning_dedup_log(trace_id, fingerprint, existing_warning_id, attempted_payload, reason)
    VALUES (
      p_trace_id, v_fp, v_existing_id,
      jsonb_build_object(
        'session_id', p_session_id,
        'instructor_id', p_instructor_id,
        'warning_type', p_warning_type,
        'settings_version', p_settings_version,
        'level_id', p_level_id,
        'content_number', p_content_number
      ),
      'fingerprint_collision'
    );
    RETURN QUERY SELECT false, NULL::uuid, v_fp, v_existing_id;
    RETURN;
  END IF;

  -- Insert new warning
  INSERT INTO public.instructor_warnings(
    session_id, instructor_id, warning_type, reason, reason_ar,
    severity, issued_by, is_active, settings_version, trace_id,
    level_id, content_number, reference_id, reference_type
  ) VALUES (
    p_session_id, p_instructor_id, p_warning_type, p_reason, p_reason_ar,
    p_severity, p_issued_by, true, p_settings_version, p_trace_id,
    p_level_id, p_content_number, p_reference_id, p_reference_type
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT true, v_new_id, v_fp, NULL::uuid;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_warning_deduped(uuid, uuid, text, text, text, text, uuid, integer, uuid, uuid, integer, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_warning_deduped(uuid, uuid, text, text, text, text, uuid, integer, uuid, uuid, integer, uuid, text) TO authenticated, service_role;